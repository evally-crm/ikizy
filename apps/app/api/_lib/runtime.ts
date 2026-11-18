import type { BookingStatus } from './clientPage.js'
import { neon } from '@neondatabase/serverless'
import { del, get, list, put } from '@vercel/blob'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import Stripe from 'stripe'
import { sendNotification, setVapidDetails } from 'web-push'
import { HttpError, type BillingDb, type Membership, type ReconcileDb, type SubscriptionRow } from './billing.js'
import type { BookingDb, BookingResult, Slot } from './booking.js'
import type { AccountDb, AccountDeps, AuditEntry } from './account.js'
import type { HousekeepingDb, RetentionCandidate } from './housekeeping.js'
import { FROM } from './authEmail.js'
import type { ExportDeps } from './export.js'
import type { CronDb } from './cron.js'
import type { LeadDb } from './lead.js'
import { reportError } from './monitoring.js'
import type { NotifyDb, OwnerContact } from './notify.js'
import type { BlobStore, PhotoStoreDb } from './photoStore.js'
import type { PushDb, PushSender } from './push.js'
import type { PlannedReminder, ReminderCandidate, ReminderDb, SendEmail } from './reminders.js'
import type { PublicSite } from './siteHtml.js'
import { throttle, type LimitKey } from './throttle.js'

/** lê uma variável de ambiente obrigatória (configurada na Vercel, nunca no código) */
export function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

export const appUrl = () => (process.env.APP_URL ?? 'https://app.ikizy.com').replace(/\/$/, '')

let stripeClient: Stripe | undefined
export function stripe(): Stripe {
  stripeClient ??= new Stripe(env('STRIPE_SECRET_KEY'))
  return stripeClient
}

// ---------------------------------------------------------------- autenticação (Neon Auth)

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

/** confere o JWT do Neon Auth enviado pelo navegador e devolve quem é a pessoa */
export async function authenticate(request: Request): Promise<{ id: string; email?: string }> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new HttpError(401, 'unauthenticated', 'Entre na sua conta para continuar.')

  const base = env('NEON_AUTH_BASE_URL')
  jwks ??= createRemoteJWKSet(new URL(`${base.replace(/\/$/, '')}/.well-known/jwks.json`))
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: new URL(base).origin })
    if (!payload.sub) throw new Error('sem sub')
    return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined }
  } catch {
    throw new HttpError(401, 'invalid_token', 'Sua sessão expirou. Entre novamente.')
  }
}

// ---------------------------------------------------------------- banco (conexão de dono, só no servidor)

type Row = Record<string, unknown>

export function createDb(): BillingDb {
  const sql = neon(env('DATABASE_URL'))
  const toDate = (v: unknown) => (v ? new Date(v as string) : null)

  return {
    async getMembership(userId): Promise<Membership | null> {
      const rows = (await sql`
        select m.salon_id, m.role, s.name
        from public.members m join public.salons s on s.id = m.salon_id
        where m.user_id = ${userId} limit 1`) as Row[]
      const r = rows[0]
      return r ? { salonId: r.salon_id as string, role: r.role as string, salonName: r.name as string } : null
    },

    async teamCounts(salonId) {
      const rows = (await sql`
        select (select count(*)::int from public.professionals where salon_id = ${salonId} and active) as professionals,
               (select count(*)::int from public.members where salon_id = ${salonId}) as members`) as Row[]
      return { professionals: Number(rows[0]?.professionals ?? 0), members: Number(rows[0]?.members ?? 0) }
    },

    async getSubscription(salonId): Promise<SubscriptionRow | null> {
      const rows = (await sql`select * from public.subscriptions where salon_id = ${salonId}`) as Row[]
      const r = rows[0]
      if (!r) return null
      return {
        salonId: r.salon_id as string,
        plan: r.plan as SubscriptionRow['plan'],
        status: r.status as SubscriptionRow['status'],
        trialEndsAt: toDate(r.trial_ends_at),
        accessUntil: toDate(r.access_until) as Date,
        billingMethod: (r.billing_method as SubscriptionRow['billingMethod']) ?? null,
        stripeCustomerId: (r.stripe_customer_id as string | null) ?? null,
        stripeSubscriptionId: (r.stripe_subscription_id as string | null) ?? null,
        cancelAtPeriodEnd: r.cancel_at_period_end === true,
      }
    },

    async setCustomerId(salonId, customerId) {
      await sql`update public.subscriptions set stripe_customer_id = ${customerId}, updated_at = now()
                where salon_id = ${salonId} and stripe_customer_id is null`
    },

    async findSalonByCustomer(customerId) {
      const rows = (await sql`select salon_id from public.subscriptions where stripe_customer_id = ${customerId}`) as Row[]
      return (rows[0]?.salon_id as string | undefined) ?? null
    },

    // dedupe + soma dos meses em UM comando: se o evento chegar duas vezes, só a primeira soma
    async applyPixPayment({ key, type, salonId, plan, months, customerId }) {
      const rows = (await sql`
        with ins as (
          insert into public.stripe_events (id, type) values (${key}, ${type})
          on conflict do nothing returning id
        )
        update public.subscriptions set
          plan = ${plan}::public.billing_plan,
          status = 'active',
          billing_method = 'pix',
          cancel_at_period_end = false,
          access_until = greatest(access_until, now()) + (${months}::int * interval '1 month'),
          stripe_customer_id = coalesce(stripe_customer_id, ${customerId}),
          plan_chosen_at = coalesce(plan_chosen_at, now()),
          updated_at = now()
        where salon_id = ${salonId} and exists (select 1 from ins)
        returning salon_id`) as Row[]
      return rows.length > 0
    },

    // eventos fora de ordem: só aplica se for mais novo que o último já aplicado
    async applySubscription(p) {
      await sql`
        update public.subscriptions set
          plan = ${p.plan}::public.billing_plan,
          status = ${p.status}::public.billing_status,
          billing_method = 'card',
          stripe_customer_id = coalesce(${p.customerId}, stripe_customer_id),
          stripe_subscription_id = ${p.subscriptionId},
          cancel_at_period_end = ${p.cancelAtPeriodEnd},
          access_until = case when ${p.onlyShrink} then least(access_until, ${p.accessUntil.toISOString()}::timestamptz)
                              else ${p.accessUntil.toISOString()}::timestamptz end,
          last_event_at = ${p.eventAt.toISOString()}::timestamptz,
          plan_chosen_at = coalesce(plan_chosen_at, now()),
          updated_at = now()
        where salon_id = ${p.salonId}
          and (last_event_at is null or last_event_at <= ${p.eventAt.toISOString()}::timestamptz)`
    },
  }
}

/** limite por pessoa nas rotas com login: chame logo depois do `authenticate`; passou do limite, responde 429 */
export function limitUser(userId: string, key: LimitKey): Promise<void> {
  const sql = neon(env('DATABASE_URL'))
  return throttle(
    {
      async limited(bucket, max, windowSeconds) {
        const rows = (await sql`select public.hit_rate_limit(${bucket}, ${max}, ${windowSeconds}) as blocked`) as { blocked: boolean }[]
        return rows[0]?.blocked === true
      },
    },
    userId,
    key,
  )
}

/** dados da página pública; null se o slug não existe ou o site ainda não foi publicado */
export async function fetchPublicSite(slug: string): Promise<PublicSite | null> {
  const sql = neon(env('DATABASE_URL'))
  const rows = (await sql`select public.get_public_site(${slug}) as site`) as { site: PublicSite | null }[]
  const site = rows[0]?.site ?? null
  if (site?.professionals?.length) {
    // dias em que cada profissional tem horário: o agendamento desliga os outros dias em vez de mostrar uma lista vazia
    const days = (await sql`
      select wh.professional_id as id, array_agg(distinct wh.weekday order by wh.weekday) as days
      from public.working_hours wh join public.salons s on s.id = wh.salon_id
      where s.slug = ${slug} group by wh.professional_id`) as { id: string; days: number[] }[]
    site.openDays = Object.fromEntries(days.map((d) => [d.id, d.days.map(Number)]))
    // quem faz cada serviço: o agendamento só mostra essas profissionais (serviço fora da lista = todas fazem)
    const links = (await sql`
      select ps.service_id as id, array_agg(ps.professional_id) as pros
      from public.professional_services ps join public.salons s on s.id = ps.salon_id
      where s.slug = ${slug} group by ps.service_id`.catch(() => [])) as { id: string; pros: string[] }[]
    if (links.length) site.serviceProfessionals = Object.fromEntries(links.map((l) => [l.id, l.pros]))
  }
  if (site) {
    // avaliações das clientes (sem a migration, o site segue sem a seção)
    const r = (await sql`select public.get_public_reviews(${slug}) as r`.catch(() => [])) as { r: PublicSite['reviews'] | null }[]
    if (r[0]?.r?.count) site.reviews = { ...r[0].r, average: Number(r[0].r.average) }
  }
  return site
}

/** página da cliente: status do pedido pelo link secreto; null se o link não existe */
export async function fetchBookingStatus(token: string): Promise<BookingStatus | null> {
  const sql = neon(env('DATABASE_URL'))
  const rows = (await sql`select public.get_booking_status(${token}) as b`) as { b: BookingStatus | null }[]
  return rows[0]?.b ?? null
}

/** grava a avaliação do pedido (a função do banco confere se foi concluído e se já não avaliou) */
export async function saveReview(token: string, rating: number, comment: string): Promise<void> {
  const sql = neon(env('DATABASE_URL'))
  await sql`select public.submit_review(${token}, ${rating}::int, ${comment})`
}

/** nome de um negócio publicado cujo site saiu do ar (acesso vencido há mais de 7 dias); null nos outros casos */
export async function fetchOfflineSiteName(slug: string): Promise<string | null> {
  const sql = neon(env('DATABASE_URL'))
  const rows = (await sql`select public.get_offline_site(${slug}) as s`) as { s: { name: string } | null }[]
  return rows[0]?.s?.name ?? null
}

/** foto (data URL) de um negócio publicado; null se não existe ou o site não está publicado */
export async function fetchPublicPhoto(id: string): Promise<string | null> {
  const sql = neon(env('DATABASE_URL'))
  const rows = (await sql`select public.get_public_photo(${id}::uuid) as d`) as { d: string | null }[]
  return rows[0]?.d ?? null
}

/** horários livres e reserva do agendamento online (funções do banco, chamadas só pelo servidor) */
export function createBookingDb(): BookingDb {
  const sql = neon(env('DATABASE_URL'))
  return {
    async slots(q) {
      const rows = (await sql`
        select public.get_booking_slots(${q.slug}, ${q.services}::uuid[], ${q.date}::date, ${q.professional}::uuid) as s`) as { s: Slot[] }[]
      return rows[0]?.s ?? []
    },
    async book(i) {
      const rows = (await sql`
        select public.book_services(${i.slug}, ${i.services}::uuid[], ${i.professional}::uuid, ${i.date}::date, ${i.minute}, ${i.name}, ${i.phone}) as r`) as {
        r: BookingResult
      }[]
      return rows[0].r
    },
    async limited(bucket, max, windowSeconds) {
      const rows = (await sql`select public.hit_rate_limit(${bucket}, ${max}, ${windowSeconds}) as blocked`) as { blocked: boolean }[]
      return rows[0]?.blocked === true
    },
  }
}

/** conferência diária com o Stripe: o mesmo banco do webhook + a lista de assinaturas de cartão conhecidas */
export function createReconcileDb(): ReconcileDb {
  const sql = neon(env('DATABASE_URL'))
  return {
    ...createDb(),
    async knownCardSubscriptions() {
      const rows = (await sql`
        select stripe_subscription_id from public.subscriptions
        where stripe_subscription_id is not null
          and (status <> 'canceled' or access_until > now() - interval '30 days')`) as Row[]
      return rows.map((r) => r.stripe_subscription_id as string)
    },
  }
}

/** tarefas automáticas (cron): conexão de dono, só no servidor */
export function createCronDb(): CronDb {
  const sql = neon(env('DATABASE_URL'))
  return {
    async expireStaleRequests() {
      const rows = (await sql`select public.expire_stale_requests() as n`) as { n: number }[]
      return Number(rows[0]?.n ?? 0)
    },
  }
}

/** avisos de cobrança por e-mail (cron): lista, reserva e devolve os envios */
export function createReminderDb(): ReminderDb {
  const sql = neon(env('DATABASE_URL'))
  return {
    async candidates() {
      const rows = (await sql`
        select s.salon_id, sa.name, s.notify_email, s.status, s.billing_method, s.cancel_at_period_end, s.access_until
        from public.subscriptions s join public.salons sa on sa.id = s.salon_id
        where s.notify_email is not null and not s.complimentary
          and (s.status = 'past_due' or (s.access_until > now() - interval '4 days' and s.access_until < now() + interval '8 days'))`) as Row[]
      return rows.map(
        (r): ReminderCandidate => ({
          salonId: r.salon_id as string,
          salonName: r.name as string,
          email: r.notify_email as string | null,
          status: r.status as ReminderCandidate['status'],
          method: r.billing_method as ReminderCandidate['method'],
          cancelAtPeriodEnd: r.cancel_at_period_end as boolean,
          accessUntil: new Date(r.access_until as string),
        }),
      )
    },
    async claim(r: PlannedReminder) {
      const rows = (await sql`
        insert into public.email_log (key, salon_id, to_email, template)
        values (${r.key}, ${r.salonId}::uuid, ${r.to}, ${r.kind})
        on conflict (key) do nothing returning key`) as Row[]
      return rows.length === 1
    },
    async release(key) {
      await sql`delete from public.email_log where key = ${key}`
    },
  }
}

/** fotos na loja: quem pode gravar e ver, e o que o banco ainda usa */
export function createPhotoStoreDb(): PhotoStoreDb {
  const sql = neon(env('DATABASE_URL'))
  return {
    async canUpload(userId, salonId, scope) {
      const roles = scope === 'site' ? ['owner', 'manager'] : ['owner', 'manager', 'reception', 'professional']
      const rows = (await sql`
        select 1 from public.members m
        where m.salon_id = ${salonId}::uuid and m.user_id = ${userId}::uuid
          and m.role::text = any(${roles}) and public.has_access(m.salon_id)`) as Row[]
      return rows.length === 1
    },
    async isMember(userId, salonId) {
      const rows = (await sql`select 1 from public.members where salon_id = ${salonId}::uuid and user_id = ${userId}::uuid`) as Row[]
      return rows.length === 1
    },
    async referencedPaths() {
      const rows = (await sql`
        select blob_path as p from public.site_photos where blob_path is not null
        union all select blob_path from public.client_photos where blob_path is not null
        union all select thumb_path from public.client_photos where thumb_path is not null`) as { p: string }[]
      return new Set(rows.map((r) => r.p))
    },
  }
}

/** a loja privada "ikizy-fotos" (Vercel Blob); na Vercel autentica sozinha, fora dela usa BLOB_READ_WRITE_TOKEN */
export const blobStore: BlobStore = {
  async put(path, image) {
    await put(path, Buffer.from(image.bytes), { access: 'private', contentType: image.type, addRandomSuffix: false, cacheControlMaxAge: 31536000 })
  },
  async list() {
    const out: { pathname: string; uploadedAt: Date }[] = []
    let cursor: string | undefined
    do {
      const page = await list({ prefix: 'salons/', limit: 1000, cursor })
      out.push(...page.blobs.map((b) => ({ pathname: b.pathname, uploadedAt: b.uploadedAt })))
      cursor = page.hasMore ? page.cursor : undefined
    } while (cursor)
    return out
  },
  async del(paths) {
    if (paths.length) await del(paths)
  },
}

/** lê um arquivo da loja; `ifNoneMatch` devolve 304 quando o navegador já tem a mesma versão */
export async function readBlob(path: string, ifNoneMatch?: string) {
  return get(path, { access: 'private', ifNoneMatch })
}

/** e-mails avulsos para a dona (novo pedido, boas-vindas): quem recebe e o registro no `email_log` */
export function createNotifyDb(): NotifyDb {
  const sql = neon(env('DATABASE_URL'))
  const contact = (r: Row): OwnerContact => ({ salonId: r.id as string, salonName: r.name as string, email: (r.notify_email as string | null) ?? null })
  return {
    async ownerBySlug(slug) {
      const rows = (await sql`
        select sa.id, sa.name, s.notify_email
        from public.salons sa left join public.subscriptions s on s.salon_id = sa.id
        where sa.slug = ${slug}`) as Row[]
      return rows[0] ? contact(rows[0]) : null
    },
    async recentOwnedSalons(userId) {
      const rows = (await sql`
        select sa.id, sa.name, s.notify_email
        from public.members m
        join public.salons sa on sa.id = m.salon_id
        left join public.subscriptions s on s.salon_id = sa.id
        where m.user_id = ${userId} and m.role = 'owner' and sa.created_at > now() - interval '7 days'`) as Row[]
      return rows.map(contact)
    },
    async claim(key, salonId, to, template) {
      const rows = (await sql`
        insert into public.email_log (key, salon_id, to_email, template)
        values (${key}, ${salonId}::uuid, ${to}, ${template})
        on conflict (key) do nothing returning key`) as Row[]
      return rows.length === 1
    },
    async release(key) {
      await sql`delete from public.email_log where key = ${key}`
    },
  }
}

/** manda um e-mail transacional pelo Resend (a chave fica só na Vercel) */
export const sendEmail: SendEmail = async ({ to, subject, html, text, headers }) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text, ...(headers ? { headers } : {}) }),
  })
  if (!res.ok) throw new Error(`resend ${res.status} ${await res.text()}`)
}

/** e-mails deixados na landing (conexão de dono, só no servidor) */
export function createLeadDb(): LeadDb {
  const sql = neon(env('DATABASE_URL'))
  return {
    async limited(bucket, max, windowSeconds) {
      const rows = (await sql`select public.hit_rate_limit(${bucket}, ${max}, ${windowSeconds}) as blocked`) as { blocked: boolean }[]
      return rows[0]?.blocked === true
    },
    async save(email) {
      const rows = (await sql`insert into public.leads (email) values (${email}) on conflict (email) do nothing returning email`) as Row[]
      return rows.length > 0
    },
    async welcomed(email) {
      await sql`update public.leads set welcomed_at = now() where email = ${email}`
    },
    async unsubscribe(email) {
      await sql`update public.leads set unsubscribed_at = coalesce(unsubscribed_at, now()) where email = ${email}`
    },
  }
}

/** excluir conta, acesso master e limpeza (conexão de dono, só no servidor) */
export function createAccountDb(): AccountDb {
  const sql = neon(env('DATABASE_URL'))
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)
  const insertAudit = (e: AuditEntry) => sql`
    insert into public.audit_log (actor_kind, actor_id, actor_email, action, salon_id, salon_name, salon_slug, details)
    values (${e.actorKind}, ${e.actorId ?? null}::uuid, ${e.actorEmail ?? null}, ${e.action}, ${e.salonId ?? null}::uuid,
            ${e.salonName ?? null}, ${e.salonSlug ?? null}, ${JSON.stringify(e.details ?? {})}::jsonb)`
  return {
    getMembership: createDb().getMembership,
    async stripeCustomer(salonId) {
      const rows = (await sql`select stripe_customer_id from public.subscriptions where salon_id = ${salonId}::uuid`) as Row[]
      return (rows[0]?.stripe_customer_id as string | null | undefined) ?? null
    },
    async cardSubscription(salonId) {
      const rows = (await sql`
        select stripe_subscription_id, cancel_at_period_end from public.subscriptions
        where salon_id = ${salonId}::uuid and billing_method = 'card' and stripe_subscription_id is not null and status in ('active', 'trialing', 'past_due')`) as Row[]
      const r = rows[0]
      return r ? { subscriptionId: r.stripe_subscription_id as string, cancelAtPeriodEnd: r.cancel_at_period_end === true } : null
    },
    async deleteSalon(salonId, audit) {
      // os atendimentos travam a remoção de clientes e profissionais (on delete restrict): saem primeiro, na mesma transação
      const steps = [sql`delete from public.appointments where salon_id = ${salonId}::uuid`, sql`delete from public.salons where id = ${salonId}::uuid`]
      await sql.transaction(audit ? [insertAudit(audit), ...steps] : steps)
    },
    async leaveSalon(salonId, userId) {
      await sql.transaction([
        sql`update public.professionals set user_id = null where salon_id = ${salonId}::uuid and user_id = ${userId}::uuid`,
        sql`delete from public.members where salon_id = ${salonId}::uuid and user_id = ${userId}::uuid`,
        sql`delete from public.push_subscriptions where salon_id = ${salonId}::uuid and user_id = ${userId}::uuid`,
      ])
    },
    async deleteUser(userId) {
      // sessões e contas (senha, Google) caem junto (on delete cascade no neon_auth)
      await sql`delete from public.push_subscriptions where user_id = ${userId}::uuid`
      await sql`delete from neon_auth."user" where id = ${userId}::uuid`
    },
    async ownerOf(salonId) {
      const rows = (await sql`select user_id from public.members where salon_id = ${salonId}::uuid and role = 'owner' limit 1`) as Row[]
      return (rows[0]?.user_id as string | undefined) ?? null
    },
    async emailVerified(userId) {
      const rows = (await sql`select "emailVerified" as ok from neon_auth."user" where id = ${userId}::uuid`) as Row[]
      return rows[0]?.ok === true
    },
    async salonInfo(salonId) {
      const rows = (await sql`select name, slug, deletion_scheduled_at, deletion_resume_billing from public.salons where id = ${salonId}::uuid`) as Row[]
      const r = rows[0]
      if (!r) return null
      return {
        name: r.name as string,
        slug: r.slug as string,
        deletionScheduledAt: r.deletion_scheduled_at ? new Date(r.deletion_scheduled_at as string) : null,
        resumeBilling: r.deletion_resume_billing === true,
      }
    },
    async contactsOf(salonId) {
      const rows = (await sql`
        select m.role, u.email
        from public.members m join neon_auth."user" u on u.id = m.user_id
        where m.salon_id = ${salonId}::uuid and u.email is not null`) as Row[]
      return {
        ownerEmail: (rows.find((r) => r.role === 'owner')?.email as string | undefined) ?? null,
        memberEmails: rows.filter((r) => r.role !== 'owner').map((r) => r.email as string),
      }
    },
    async salonCounts(salonId) {
      const rows = (await sql`
        select (select count(*)::int from public.clients where salon_id = ${salonId}::uuid and forgotten_at is null) as clients,
               (select count(*)::int from public.appointments where salon_id = ${salonId}::uuid) as appointments,
               (select count(*)::int from public.members where salon_id = ${salonId}::uuid) as members`) as Row[]
      return { clients: Number(rows[0]?.clients ?? 0), appointments: Number(rows[0]?.appointments ?? 0), members: Number(rows[0]?.members ?? 0) }
    },
    async scheduleDeletion(salonId, requestedAt, scheduledAt, resumeBilling) {
      await sql`
        update public.salons set deletion_requested_at = ${requestedAt.toISOString()}::timestamptz,
               deletion_scheduled_at = ${scheduledAt.toISOString()}::timestamptz, deletion_resume_billing = ${resumeBilling}
        where id = ${salonId}::uuid`
    },
    async cancelDeletion(salonId) {
      await sql`
        update public.salons set deletion_requested_at = null, deletion_scheduled_at = null, deletion_resume_billing = false
        where id = ${salonId}::uuid`
    },
    async dueDeletions(now) {
      const rows = (await sql`
        select id, name, slug from public.salons
        where deletion_scheduled_at is not null and deletion_scheduled_at <= ${now.toISOString()}::timestamptz
        order by deletion_scheduled_at`) as Row[]
      return rows.map((r) => ({ salonId: r.id as string, name: r.name as string, slug: r.slug as string }))
    },
    async audit(entry) {
      await insertAudit(entry)
    },
    async listAudit(limit) {
      const rows = (await sql`
        select id, at, actor_kind, actor_email, action, salon_name, salon_slug, details
        from public.audit_log order by id desc limit ${limit}`) as Row[]
      return rows.map((r) => ({
        id: Number(r.id),
        at: iso(r.at) as string,
        actorKind: r.actor_kind as string,
        actorEmail: (r.actor_email as string | null) ?? null,
        action: r.action as string,
        salonName: (r.salon_name as string | null) ?? null,
        salonSlug: (r.salon_slug as string | null) ?? null,
        details: (r.details as Record<string, unknown>) ?? {},
      }))
    },
    async listSalons() {
      const rows = (await sql`
        select sa.id, sa.name, sa.slug, sa.created_at, sa.deletion_scheduled_at,
               u.email as owner_email, u.name as owner_name,
               s.plan, s.status, s.access_until, s.billing_method,
               (select count(*)::int from public.clients c where c.salon_id = sa.id and c.forgotten_at is null) as clients,
               (select count(*)::int from public.appointments a where a.salon_id = sa.id) as appointments,
               (select count(*)::int from public.members m2 where m2.salon_id = sa.id) as members
        from public.salons sa
        left join public.members m on m.salon_id = sa.id and m.role = 'owner'
        left join neon_auth."user" u on u.id = m.user_id
        left join public.subscriptions s on s.salon_id = sa.id
        order by sa.created_at desc`) as Row[]
      return rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        slug: r.slug as string,
        createdAt: iso(r.created_at) as string,
        ownerEmail: (r.owner_email as string | null) ?? null,
        ownerName: (r.owner_name as string | null) ?? null,
        plan: (r.plan as string | null) ?? null,
        status: (r.status as string | null) ?? null,
        accessUntil: iso(r.access_until),
        method: (r.billing_method as string | null) ?? null,
        clients: Number(r.clients ?? 0),
        appointments: Number(r.appointments ?? 0),
        members: Number(r.members ?? 0),
        deletionScheduledAt: iso(r.deletion_scheduled_at),
      }))
    },
  }
}

/** chave pública dos avisos no aparelho (VAPID); null = avisos não configurados neste ambiente */
export const vapidPublicKey = (): string | null => process.env.VAPID_PUBLIC_KEY ?? null

/** envia os avisos pelo serviço de push do navegador; null se as chaves (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) não estão configuradas */
export function createPushSender(): PushSender | null {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return null
  setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:contato@ikizy.com', pub, priv)
  return async (sub, payload) => {
    try {
      const res = await sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: 'high', timeout: 3500 })
      return { status: res.statusCode }
    } catch (error) {
      // o serviço respondeu com erro (404/410 = aparelho que saiu): devolve o código; sem resposta, o erro sobe
      const status = (error as { statusCode?: number }).statusCode
      if (typeof status === 'number') return { status }
      throw error
    }
  }
}

/** avisos no aparelho (conexão de dono, só no servidor) */
export function createPushDb(): PushDb {
  const sql = neon(env('DATABASE_URL'))
  return {
    async salonIdBySlug(slug) {
      const rows = (await sql`select id from public.salons where slug = ${slug}`) as Row[]
      return (rows[0]?.id as string | undefined) ?? null
    },
    async roleOf(userId, salonId) {
      const rows = (await sql`select role from public.members where user_id = ${userId}::uuid and salon_id = ${salonId}::uuid`) as Row[]
      return (rows[0]?.role as string | undefined) ?? null
    },
    async save(userId, salonId, sub, userAgent) {
      // o mesmo aparelho (endereço) volta a valer para quem ligou por último
      await sql`
        insert into public.push_subscriptions (user_id, salon_id, endpoint, p256dh, auth, user_agent)
        values (${userId}::uuid, ${salonId}::uuid, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${userAgent})
        on conflict (endpoint) do update set user_id = excluded.user_id, salon_id = excluded.salon_id, p256dh = excluded.p256dh,
          auth = excluded.auth, user_agent = excluded.user_agent`
    },
    async remove(userId, endpoint) {
      await sql`delete from public.push_subscriptions where endpoint = ${endpoint} and user_id = ${userId}::uuid`
    },
    async listForSalon(salonId) {
      const rows = (await sql`
        select p.user_id, p.endpoint, p.p256dh, p.auth
        from public.push_subscriptions p join public.members m on m.user_id = p.user_id and m.salon_id = p.salon_id
        where p.salon_id = ${salonId}::uuid and m.role in ('owner', 'manager', 'reception')`) as Row[]
      return rows.map((r) => ({ userId: r.user_id as string, endpoint: r.endpoint as string, keys: { p256dh: r.p256dh as string, auth: r.auth as string } }))
    },
    async drop(endpoint) {
      await sql`delete from public.push_subscriptions where endpoint = ${endpoint}`
    },
    async pendingCount(salonId) {
      const rows = (await sql`select count(*)::int as n from public.appointments where salon_id = ${salonId}::uuid and status = 'pendente'`) as Row[]
      return Number(rows[0]?.n ?? 0)
    },
  }
}

/** tabelas do negócio que entram na cópia dos dados (lista fechada: nada de segredo, token nem dado do Stripe) */
const EXPORT_TABLES = [
  'professionals',
  'services',
  'products',
  'clients',
  'client_notes',
  'appointments',
  'expenses',
  'month_closings',
  'working_hours',
  'professional_services',
  'reviews',
  'client_plans',
  'showcase_items',
  'site_settings',
] as const

/** exportar os dados do negócio (conexão de dono, só no servidor): tudo sempre filtrado pelo negócio da dona logada */
export function createExportLoader(): ExportDeps['load'] {
  const sql = neon(env('DATABASE_URL'))
  return async (salonId) => {
    const q = (text: string) => sql.query(text, [salonId]) as Promise<Row[]>
    const tables: Record<string, Row[]> = {}
    for (const t of EXPORT_TABLES) tables[t] = await q(`select * from public.${t} where salon_id = $1::uuid order by 1`)
    // fotos: só a lista (as imagens não vão no arquivo)
    tables.client_photos = await q(`select id, client_id, kind, caption, taken_on, created_at from public.client_photos where salon_id = $1::uuid order by created_at`)
    tables.site_photos = await q(`select id, created_at from public.site_photos where salon_id = $1::uuid order by created_at`)
    const [salon] = await q(`select id, name, slug, created_at from public.salons where id = $1::uuid`)
    const [subscription] = await q(`select plan, status, trial_ends_at, access_until, billing_method from public.subscriptions where salon_id = $1::uuid`)
    const team = await q(`
      select u.name, u.email, m.role, m.created_at as since
      from public.members m join neon_auth."user" u on u.id = m.user_id
      where m.salon_id = $1::uuid order by m.created_at`)
    return { salon: salon ?? {}, subscription: subscription ?? null, team, tables }
  }
}

/** limpeza diária: o que o banco precisa responder (conexão de dono, só no servidor) */
export function createHousekeepingDb(): HousekeepingDb {
  const sql = neon(env('DATABASE_URL'))
  return {
    async retentionCandidates(now) {
      const rows = (await sql`
        select sa.id, sa.name, sa.slug, s.status, s.access_until, s.notify_email,
               (select l.sent_at from public.email_log l where l.key = 'retention-warn:' || sa.id::text) as warned_at
        from public.salons sa join public.subscriptions s on s.salon_id = sa.id
        where s.status <> 'active' and not s.complimentary and sa.deletion_scheduled_at is null
          and s.access_until < ${now.toISOString()}::timestamptz - interval '83 days'`) as Row[]
      return rows.map(
        (r): RetentionCandidate => ({
          salonId: r.id as string,
          name: r.name as string,
          slug: r.slug as string,
          status: r.status as string,
          accessUntil: new Date(r.access_until as string),
          notifyEmail: (r.notify_email as string | null) ?? null,
          warnedAt: r.warned_at ? new Date(r.warned_at as string) : null,
        }),
      )
    },
    async claimWarning(salonId, to) {
      const rows = (await sql`
        insert into public.email_log (key, salon_id, to_email, template)
        values (${'retention-warn:' + salonId}, ${salonId}::uuid, ${to}, 'retention_warn')
        on conflict (key) do nothing returning key`) as Row[]
      return rows.length === 1
    },
    async releaseWarning(salonId) {
      await sql`delete from public.email_log where key = ${'retention-warn:' + salonId}`
    },
    async orphanLogins(now, protectEmails, limit) {
      const rows = (await sql`
        select u.id from neon_auth."user" u
        where not exists (select 1 from public.members m where m.user_id = u.id)
          and not exists (select 1 from public.professionals p where p.user_id = u.id)
          and lower(u.email) <> all (${protectEmails.map((e) => e.toLowerCase())}::text[])
          and ((not u."emailVerified" and u."createdAt" < ${now.toISOString()}::timestamptz - interval '7 days')
            or u."createdAt" < ${now.toISOString()}::timestamptz - interval '90 days')
        order by u."createdAt" limit ${limit}`) as Row[]
      return rows.map((r) => r.id as string)
    },
    async deleteUsers(ids) {
      if (!ids.length) return 0
      const rows = (await sql`delete from neon_auth."user" where id = any(${ids}::uuid[]) returning id`) as Row[]
      return rows.length
    },
    async deleteStaleInvites(now) {
      const rows = (await sql`delete from public.invites where expires_at < ${now.toISOString()}::timestamptz - interval '30 days' returning id`) as Row[]
      return rows.length
    },
  }
}

/** tudo que excluir conta, o master e a limpeza diária usam, ligado aos serviços de verdade (Stripe, loja de fotos, e-mail) */
export function createAccountDeps(): AccountDeps {
  return {
    db: createAccountDb(),
    deleteCustomer: async (id) => {
      await stripe().customers.del(id)
    },
    setCancelAtPeriodEnd: async (subscriptionId, value) => {
      await stripe().subscriptions.update(subscriptionId, { cancel_at_period_end: value })
    },
    deletePhotos: deleteBlobPrefix,
    send: sendEmail,
    appUrl: appUrl(),
  }
}

/** apaga da loja tudo que começa com o prefixo (ex.: salons/<negócio>/) */
export async function deleteBlobPrefix(prefix: string): Promise<void> {
  let cursor: string | undefined
  do {
    const page = await list({ prefix, limit: 1000, cursor })
    if (page.blobs.length) await del(page.blobs.map((b) => b.url))
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
}

/** grava o e-mail da dona para os avisos; só quem é dona do negócio muda a própria assinatura */
export async function setNotifyEmail(userId: string, email: string): Promise<void> {
  const sql = neon(env('DATABASE_URL'))
  await sql`
    update public.subscriptions s set notify_email = ${email}
    from public.members m
    where m.salon_id = s.salon_id and m.user_id = ${userId} and m.role = 'owner'
      and s.notify_email is distinct from ${email}`
}

// ---------------------------------------------------------------- respostas HTTP

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

/** converte qualquer erro numa resposta; erros inesperados não vazam detalhes */
export function fail(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.code, message: error.message }, error.status)
  reportError(error)
  return json({ error: 'internal', message: 'Algo deu errado. Tente novamente em instantes.' }, 500)
}

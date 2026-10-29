import { neon } from '@neondatabase/serverless'
import { del, get, list, put } from '@vercel/blob'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import Stripe from 'stripe'
import { HttpError, type BillingDb, type Membership, type ReconcileDb, type SubscriptionRow } from './billing.js'
import type { BookingDb, BookingResult, Slot } from './booking.js'
import { FROM } from './authEmail.js'
import type { CronDb } from './cron.js'
import type { LeadDb } from './lead.js'
import { reportError } from './monitoring.js'
import type { NotifyDb, OwnerContact } from './notify.js'
import type { BlobStore, PhotoStoreDb } from './photoStore.js'
import type { PlannedReminder, ReminderCandidate, ReminderDb, SendEmail } from './reminders.js'
import type { PublicSite } from './siteHtml.js'

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

/** dados da página pública; null se o slug não existe ou o site ainda não foi publicado */
export async function fetchPublicSite(slug: string): Promise<PublicSite | null> {
  const sql = neon(env('DATABASE_URL'))
  const rows = (await sql`select public.get_public_site(${slug}) as site`) as { site: PublicSite | null }[]
  return rows[0]?.site ?? null
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
        select public.get_available_slots(${q.slug}, ${q.service}::uuid, ${q.date}::date, ${q.professional}::uuid) as s`) as { s: Slot[] }[]
      return rows[0]?.s ?? []
    },
    async book(i) {
      const rows = (await sql`
        select public.book_appointment(${i.slug}, ${i.service}::uuid, ${i.professional}::uuid, ${i.date}::date, ${i.minute}, ${i.name}, ${i.phone}) as r`) as {
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
        where s.notify_email is not null
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
export const sendEmail: SendEmail = async ({ to, subject, html, text }) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
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
  }
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

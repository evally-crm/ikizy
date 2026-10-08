import { neon } from '@neondatabase/serverless'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import Stripe from 'stripe'
import { HttpError, type BillingDb, type Membership, type SubscriptionRow } from './billing.js'
import type { BookingDb, BookingResult, Slot } from './booking.js'
import type { CampaignDb, CampaignSummary, ClaimedMessage, CreateResult } from './campaigns.js'
import { createEvolutionGateway, type InstanceState, type WhatsappGateway } from './evolution.js'
import { GAP_SECONDS, FREE_CAMPAIGNS_PER_MONTH, MAX_RECIPIENTS, MIN_RECIPIENTS, type TemplateId } from '../../src/lib/campaigns.js'
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
          updated_at = now()
        where salon_id = ${salonId} and exists (select 1 from ins)
        returning salon_id`) as Row[]
      return rows.length > 0
    },

    async addCampaignCredits({ key, type, salonId, credits }) {
      const rows = (await sql`select public.add_campaign_credits(${key}, ${type}, ${salonId}::uuid, ${credits}) as ok`) as Row[]
      return rows[0]?.ok === true
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
  }
}

// ---------------------------------------------------------------- campanhas no WhatsApp (Evolution API)

/** null quando a Evolution não está configurada (a tela mostra "ainda não disponível") */
export function whatsappGateway(): WhatsappGateway | null {
  const url = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  return url && apiKey ? createEvolutionGateway({ url, apiKey }) : null
}

/** a Evolution avisa aqui quando o WhatsApp conecta/cai e quando uma cliente responde SAIR */
export const whatsappWebhookUrl = () => `${appUrl()}/api/whatsapp/webhook?token=${encodeURIComponent(process.env.EVOLUTION_WEBHOOK_SECRET ?? '')}`

export function createCampaignDb(): CampaignDb {
  const sql = neon(env('DATABASE_URL'))
  const billing = createDb()
  const asState = (v: unknown): InstanceState => (v === 'open' || v === 'connecting' ? v : 'close')

  return {
    getMembership: billing.getMembership,

    async getInstance(salonId) {
      const rows = (await sql`select instance_name, state, phone from public.whatsapp_instances where salon_id = ${salonId}`) as Row[]
      const r = rows[0]
      return r ? { name: r.instance_name as string, state: asState(r.state), phone: (r.phone as string | null) ?? null } : null
    },

    async saveInstance(salonId, name, state, phone) {
      await sql`
        insert into public.whatsapp_instances (salon_id, instance_name, state, phone) values (${salonId}, ${name}, ${state}, ${phone})
        on conflict (salon_id) do update set state = excluded.state, phone = coalesce(excluded.phone, public.whatsapp_instances.phone), updated_at = now()`
    },

    async findSalonByInstance(name) {
      const rows = (await sql`select salon_id from public.whatsapp_instances where instance_name = ${name}`) as Row[]
      return (rows[0]?.salon_id as string | undefined) ?? null
    },

    async setInstanceState(name, state, phone) {
      const rows = (await sql`
        update public.whatsapp_instances set state = ${state}, phone = coalesce(${phone ?? null}, phone), updated_at = now()
        where instance_name = ${name} returning salon_id`) as Row[]
      return (rows[0]?.salon_id as string | undefined) ?? null
    },

    async getSalon(salonId) {
      const rows = (await sql`
        select s.name, s.slug, coalesce(ss.published, false) as published
        from public.salons s left join public.site_settings ss on ss.salon_id = s.id where s.id = ${salonId}`) as Row[]
      const r = rows[0]
      return { name: (r?.name as string) ?? '', siteUrl: r?.published ? `https://${r.slug as string}.ikizy.com` : undefined }
    },

    async getQuota(salonId) {
      const rows = (await sql`select public.campaign_quota(${salonId}::uuid) as q`) as { q: { used_free: number; credits: number } }[]
      return { usedFree: Number(rows[0]?.q.used_free ?? 0), credits: Number(rows[0]?.q.credits ?? 0) }
    },

    async listCampaigns(salonId) {
      const rows = (await sql`
        select c.id, c.template, c.preview, c.status, c.used_credit, c.total, c.created_at,
               count(m.id) filter (where m.status = 'sent') as sent,
               count(m.id) filter (where m.status = 'failed') as failed
        from public.campaigns c left join public.campaign_messages m on m.campaign_id = c.id
        where c.salon_id = ${salonId}
        group by c.id order by c.created_at desc limit 20`) as Row[]
      return rows.map(
        (r): CampaignSummary => ({
          id: r.id as string,
          template: r.template as TemplateId,
          preview: r.preview as string,
          status: r.status as CampaignSummary['status'],
          usedCredit: r.used_credit === true,
          total: Number(r.total),
          sent: Number(r.sent),
          failed: Number(r.failed),
          createdAt: new Date(r.created_at as string).toISOString(),
        }),
      )
    },

    async exclusions(salonId) {
      const rows = (await sql`
        select id, offers_opt_out_at is not null as saiu,
               exists (select 1 from public.campaign_messages m where m.client_id = c.id and m.month = public.campaign_month()
                       and m.status in ('queued', 'sending', 'sent')) as recebeu
        from public.clients c where c.salon_id = ${salonId}`) as Row[]
      return {
        optedOut: rows.filter((r) => r.saiu === true).map((r) => r.id as string),
        receivedThisMonth: rows.filter((r) => r.recebeu === true).map((r) => r.id as string),
      }
    },

    async getClients(salonId, ids) {
      const rows = (await sql`
        select id, name, phone from public.clients
        where salon_id = ${salonId} and id = any(${ids}::uuid[]) and offers_opt_out_at is null`) as Row[]
      return rows.map((r) => ({ id: r.id as string, name: r.name as string, phone: r.phone as string }))
    },

    async createCampaign(p) {
      const rows = (await sql`
        select public.create_offer_campaign(
          ${p.salonId}::uuid, ${p.userId}::uuid, ${p.template}, ${JSON.stringify(p.fields)}::jsonb, ${p.preview},
          ${JSON.stringify(p.messages)}::jsonb, ${FREE_CAMPAIGNS_PER_MONTH}, ${MIN_RECIPIENTS}, ${MAX_RECIPIENTS},
          ${GAP_SECONDS.min}, ${GAP_SECONDS.max}) as r`) as { r: CreateResult }[]
      return rows[0].r
    },

    async cancelCampaign(salonId, id) {
      const rows = (await sql`select public.cancel_offer_campaign(${salonId}::uuid, ${id}::uuid) as r`) as { r: { ok: boolean; error?: string; refunded?: boolean } }[]
      return rows[0].r
    },

    async claim(limit) {
      const rows = (await sql`select * from public.claim_campaign_messages(${limit})`) as Row[]
      return rows.map(
        (r): ClaimedMessage => ({ id: r.id as string, salonId: r.salon_id as string, instance: r.instance_name as string, phone: r.phone as string, body: r.body as string }),
      )
    },

    async finish(id, ok, error) {
      await sql`select public.finish_campaign_message(${id}::uuid, ${ok}, ${error ?? null})`
    },

    async requeue(id) {
      await sql`select public.requeue_campaign_message(${id}::uuid)`
    },

    async pause(salonId, messageId) {
      await sql`select public.pause_salon_campaigns(${salonId}::uuid, ${messageId ?? null}::uuid)`
    },

    async resume(salonId) {
      await sql`select public.resume_salon_campaigns(${salonId}::uuid)`
    },

    async optOut(salonId, phones) {
      const rows = (await sql`select public.opt_out_offers(${salonId}::uuid, ${phones}::text[]) as n`) as Row[]
      return Number(rows[0]?.n ?? 0)
    },
  }
}

// ---------------------------------------------------------------- respostas HTTP

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

/** converte qualquer erro numa resposta; erros inesperados não vazam detalhes */
export function fail(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.code, message: error.message }, error.status)
  console.error(error)
  return json({ error: 'internal', message: 'Algo deu errado. Tente novamente em instantes.' }, 500)
}

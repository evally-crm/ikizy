import { neon } from '@neondatabase/serverless'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import Stripe from 'stripe'
import { HttpError, type BillingDb, type Membership, type SubscriptionRow } from './billing.js'
import type { BookingDb, BookingResult, Slot } from './booking.js'
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

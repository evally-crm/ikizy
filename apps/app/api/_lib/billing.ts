import type Stripe from 'stripe'
import {
  GRACE_DAYS,
  MIN_TRIAL_END_HOURS,
  PLANS,
  fitsPlan,
  isPixMonths,
  isPlanId,
  pixAmountCents,
  monthsLabel,
  priceLookupKey,
  type BillingMethod,
  type BillingStatus,
  type PixMonths,
  type PlanId,
} from '../../src/lib/plans.js'

/** erro com código HTTP e mensagem segura para mostrar à pessoa */
export class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface Membership {
  salonId: string
  salonName: string
  role: string
}

export interface SubscriptionRow {
  salonId: string
  plan: PlanId
  status: BillingStatus
  trialEndsAt: Date | null
  accessUntil: Date
  billingMethod: BillingMethod | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  cancelAtPeriodEnd: boolean
}

/** tudo que o servidor precisa do banco; a implementação real fica em db.ts */
export interface BillingDb {
  getMembership(userId: string): Promise<Membership | null>
  getSubscription(salonId: string): Promise<SubscriptionRow | null>
  /** profissionais ativas e logins do negócio, para conferir se a equipe cabe no plano escolhido */
  teamCounts(salonId: string): Promise<{ professionals: number; members: number }>
  setCustomerId(salonId: string, customerId: string): Promise<void>
  findSalonByCustomer(customerId: string): Promise<string | null>
  /** soma meses ao acesso, uma única vez por `key` (o Stripe reenvia eventos) */
  applyPixPayment(p: { key: string; type: string; salonId: string; plan: PlanId; months: PixMonths; customerId: string | null }): Promise<boolean>
  applySubscription(p: {
    salonId: string
    plan: PlanId
    status: BillingStatus
    accessUntil: Date
    /** em assinatura cancelada o acesso só pode diminuir, nunca aumentar */
    onlyShrink: boolean
    customerId: string | null
    subscriptionId: string
    cancelAtPeriodEnd: boolean
    eventAt: Date
  }): Promise<void>
}

const DAY = 24 * 60 * 60 * 1000
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)

// ---------------------------------------------------------------- checkout

export interface CheckoutInput {
  plan: PlanId
  method: BillingMethod
  months: PixMonths
  /** de onde veio: o passo de plano do cadastro volta para ele; o resto volta para a tela de assinatura */
  from: 'onboarding' | 'assinatura'
}

export function parseCheckoutInput(body: unknown): CheckoutInput {
  const b = (body ?? {}) as Record<string, unknown>
  if (!isPlanId(b.plan)) throw new HttpError(400, 'invalid_plan', 'Plano inválido.')
  if (b.method !== 'card' && b.method !== 'pix') throw new HttpError(400, 'invalid_method', 'Forma de pagamento inválida.')
  const months = b.months === undefined ? 1 : b.months
  if (b.method === 'pix' && !isPixMonths(months)) throw new HttpError(400, 'invalid_months', 'Período inválido para o Pix.')
  const from = b.from === 'onboarding' ? 'onboarding' : 'assinatura'
  return { plan: b.plan, method: b.method, months: (b.method === 'pix' ? months : 1) as PixMonths, from }
}

interface CheckoutDeps {
  db: BillingDb
  stripe: Stripe
  appUrl: string
  now?: Date
  /** configuração do portal criada por scripts/stripe-setup.ts (opcional) */
  portalConfiguration?: string
}

/** só a dona do negócio paga; devolve a URL do Checkout hospedado pelo Stripe */
export async function createCheckout(deps: CheckoutDeps, user: { id: string; email?: string }, input: CheckoutInput) {
  const { db, stripe, appUrl } = deps
  const now = deps.now ?? new Date()

  const member = await db.getMembership(user.id)
  if (!member) throw new HttpError(404, 'no_salon', 'Você ainda não tem um negócio cadastrado.')
  if (member.role !== 'owner') throw new HttpError(403, 'not_owner', 'Só a dona do negócio pode assinar ou alterar o plano.')
  const sub = await db.getSubscription(member.salonId)
  if (!sub) throw new HttpError(404, 'no_subscription', 'Assinatura não encontrada.')

  // cartão ativo: mudanças e cancelamento acontecem no portal, não num novo checkout (evita cobrar duas vezes)
  const hasLiveCardSubscription =
    !!sub.stripeSubscriptionId && sub.billingMethod === 'card' && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') && !sub.cancelAtPeriodEnd
  if (hasLiveCardSubscription) {
    throw new HttpError(409, 'use_portal', 'Você já tem uma assinatura no cartão. Gerencie pelo portal de pagamento.')
  }

  // plano menor só se a equipe couber nele (R-106); o banco também não deixa crescer além do limite
  if (!fitsPlan(input.plan, await db.teamCounts(member.salonId))) {
    throw new HttpError(409, 'team_too_big', `Sua equipe passa do limite do plano ${PLANS[input.plan].name}. Desative profissionais ou remova acessos em Meu negócio → Equipe antes de trocar.`)
  }

  let customerId = sub.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: member.salonName,
      metadata: { salon_id: member.salonId },
    })
    customerId = customer.id
    await db.setCustomerId(member.salonId, customerId)
  }

  const plan = PLANS[input.plan]
  const returnPath = input.from === 'onboarding' ? '/cadastro/plano' : '/dashboard/assinatura'
  const base = {
    customer: customerId,
    client_reference_id: member.salonId,
    locale: 'pt-BR' as const,
    success_url: `${appUrl}${returnPath}?retorno=ok`,
    cancel_url: `${appUrl}${returnPath}?retorno=cancelado`,
  }

  if (input.method === 'pix') {
    const session = await stripe.checkout.sessions.create({
      ...base,
      mode: 'payment',
      allowed_payment_method_types: ['pix'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'brl',
            unit_amount: pixAmountCents(input.plan, input.months),
            product_data: { name: `IKIZY ${plan.name} · ${monthsLabel(input.months)}` },
          },
        },
      ],
      payment_method_options: { pix: { expires_after_seconds: 24 * 60 * 60 } },
      metadata: { kind: 'pix_prepaid', salon_id: member.salonId, plan: input.plan, months: String(input.months) },
    })
    if (!session.url) throw new HttpError(502, 'stripe_no_url', 'Não foi possível abrir o pagamento agora.')
    return { url: session.url }
  }

  const prices = await stripe.prices.list({ lookup_keys: [priceLookupKey(input.plan)], active: true, limit: 1 })
  const price = prices.data[0]
  if (!price) throw new HttpError(500, 'price_missing', 'Preço do plano não configurado no Stripe.')

  // quem assina ainda no teste (qualquer plano) não perde os dias que sobraram: a 1ª cobrança vem no fim dele (o Stripe exige >= 48 h)
  let trialEnd: number | undefined
  if (
    plan.trialDays > 0 &&
    sub.status === 'trialing' &&
    sub.trialEndsAt &&
    sub.trialEndsAt.getTime() - now.getTime() > MIN_TRIAL_END_HOURS * 60 * 60 * 1000
  ) {
    trialEnd = Math.floor(sub.trialEndsAt.getTime() / 1000)
  }

  const session = await stripe.checkout.sessions.create({
    ...base,
    mode: 'subscription',
    allowed_payment_method_types: ['card'],
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: {
      metadata: { salon_id: member.salonId, plan: input.plan },
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    },
    metadata: { kind: 'card_subscription', salon_id: member.salonId, plan: input.plan },
  })
  if (!session.url) throw new HttpError(502, 'stripe_no_url', 'Não foi possível abrir o pagamento agora.')
  return { url: session.url }
}

export async function createPortal(deps: CheckoutDeps, user: { id: string }) {
  const { db, stripe, appUrl, portalConfiguration } = deps
  const member = await db.getMembership(user.id)
  if (!member) throw new HttpError(404, 'no_salon', 'Você ainda não tem um negócio cadastrado.')
  if (member.role !== 'owner') throw new HttpError(403, 'not_owner', 'Só a dona do negócio pode gerenciar a assinatura.')
  const sub = await db.getSubscription(member.salonId)
  if (!sub?.stripeCustomerId) throw new HttpError(404, 'no_customer', 'Ainda não há pagamentos para gerenciar.')
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl}/dashboard/assinatura`,
    ...(portalConfiguration ? { configuration: portalConfiguration } : {}),
  })
  return { url: session.url }
}

// ---------------------------------------------------------------- webhook

function mapStatus(status: Stripe.Subscription.Status): BillingStatus | null {
  switch (status) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
    case 'paused':
      return 'canceled'
    default:
      return null // incomplete: ainda não pagou, não libera acesso
  }
}

/** versões novas da API do Stripe guardam o fim do período no item da assinatura */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): number | null {
  const fromItem = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end
  return fromItem?.current_period_end ?? legacy ?? null
}

function planFromSubscription(sub: Stripe.Subscription): PlanId | null {
  if (isPlanId(sub.metadata?.plan)) return sub.metadata.plan
  const key = sub.items?.data?.[0]?.price?.lookup_key
  return (['solo', 'studio', 'salao'] as const).find((p) => priceLookupKey(p) === key) ?? null
}

const customerIdOf = (c: string | { id: string } | null | undefined) => (typeof c === 'string' ? c : (c?.id ?? null))

/** aplica um evento do Stripe no banco. Idempotente: reprocessar o mesmo evento não muda o resultado. */
export async function handleStripeEvent(event: Stripe.Event, db: BillingDb): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const s = event.data.object as Stripe.Checkout.Session
      const salonId = s.metadata?.salon_id
      if (!salonId) return
      const customerId = customerIdOf(s.customer)

      if (s.mode === 'payment' && s.metadata?.kind === 'pix_prepaid') {
        // Pix confirma depois: só libera quando o Stripe diz que foi pago
        if (s.payment_status !== 'paid') return
        const plan = s.metadata.plan
        const months = Number(s.metadata.months)
        if (!isPlanId(plan) || !isPixMonths(months)) return
        await db.applyPixPayment({ key: `pix:${s.id}`, type: event.type, salonId, plan, months, customerId })
      } else if (s.mode === 'subscription' && customerId) {
        await db.setCustomerId(salonId, customerId)
      }
      return
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = customerIdOf(sub.customer)
      const salonId = sub.metadata?.salon_id || (customerId ? await db.findSalonByCustomer(customerId) : null)
      if (!salonId) return
      const status = mapStatus(sub.status)
      const plan = planFromSubscription(sub)
      const end = subscriptionPeriodEnd(sub)
      if (!status || !plan || !end) return

      await db.applySubscription({
        salonId,
        plan,
        status,
        accessUntil: addDays(new Date(end * 1000), GRACE_DAYS),
        onlyShrink: status === 'canceled',
        customerId,
        subscriptionId: sub.id,
        cancelAtPeriodEnd: sub.cancel_at_period_end === true,
        eventAt: new Date(event.created * 1000),
      })
      return
    }

    default:
      return
  }
}

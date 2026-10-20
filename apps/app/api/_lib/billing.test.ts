import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type Stripe from 'stripe'
import {
  HttpError,
  changePlan,
  createCheckout,
  createPortal,
  handleStripeEvent,
  parseCheckoutInput,
  reconcileStripe,
  subscriptionPeriodEnd,
  type BillingDb,
  type Membership,
  type ReconcileDb,
  type SubscriptionRow,
} from './billing.js'
import { PLANS as LANDING_PLANS, PIX_DISCOUNT_PCT as LANDING_DISCOUNT, PIX_MONTHS as LANDING_MONTHS, TRIAL_DAYS as LANDING_TRIAL_DAYS, pixTotalCents } from '../../../landing/src/lib/pricing.js'
import { isCardTrial, PIX_DISCOUNT_PCT, PIX_MONTHS, PLANS, TRIAL_DAYS, accessState, daysLeft, describeSubscription, parseSubscription, periodEnd, pixAmountCents, pixFullCents, type SubscriptionInfo } from '../../src/lib/plans.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-10T12:00:00Z')

// ---------------------------------------------------------------- fakes

function fakeDb(opts: { member?: Membership | null; sub?: Partial<SubscriptionRow> | null; team?: { professionals: number; members: number } } = {}) {
  const calls = { setCustomerId: [] as string[], pix: [] as Parameters<BillingDb['applyPixPayment']>[0][], subs: [] as Parameters<BillingDb['applySubscription']>[0][] }
  const seen = new Set<string>()
  const member = opts.member === undefined ? { salonId: 'salon-1', salonName: 'Studio Teste', role: 'owner' } : opts.member
  const sub: SubscriptionRow | null =
    opts.sub === null
      ? null
      : {
          salonId: 'salon-1',
          plan: 'solo',
          status: 'trialing',
          trialEndsAt: new Date(NOW.getTime() + 20 * DAY),
          accessUntil: new Date(NOW.getTime() + 20 * DAY),
          billingMethod: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          cancelAtPeriodEnd: false,
          ...opts.sub,
        }
  const db: BillingDb = {
    getMembership: async () => member,
    getSubscription: async () => sub,
    teamCounts: async () => opts.team ?? { professionals: 1, members: 1 },
    setCustomerId: async (_s, c) => void calls.setCustomerId.push(c),
    findSalonByCustomer: async (c) => (c === 'cus_known' ? 'salon-9' : null),
    applyPixPayment: async (p) => {
      if (seen.has(p.key)) return false
      seen.add(p.key)
      calls.pix.push(p)
      return true
    },
    applySubscription: async (p) => void calls.subs.push(p),
  }
  return { db, calls }
}

function fakeStripe() {
  const created: Record<string, unknown>[] = []
  let customers = 0
  const stripe = {
    customers: { create: async () => ({ id: `cus_new_${++customers}` }) },
    prices: { list: async ({ lookup_keys }: { lookup_keys: string[] }) => ({ data: [{ id: `price_${lookup_keys[0]}` }] }) },
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          created.push(params)
          return { url: 'https://checkout.stripe.test/session' }
        },
      },
    },
    billingPortal: { sessions: { create: async () => ({ url: 'https://portal.stripe.test/session' }) } },
  } as unknown as Stripe
  return { stripe, created }
}

const user = { id: 'user-1', email: 'dona@exemplo.com' }
const deps = (db: BillingDb, stripe: Stripe) => ({ db, stripe, appUrl: 'https://app.ikizy.com', now: NOW })

async function rejects(p: Promise<unknown>, status: number, code?: string) {
  await assert.rejects(p, (e: unknown) => e instanceof HttpError && e.status === status && (!code || e.code === code))
}

// ---------------------------------------------------------------- entrada

describe('parseCheckoutInput', () => {
  it('aceita cartão e Pix com meses válidos', () => {
    assert.deepEqual(parseCheckoutInput({ plan: 'studio', method: 'card' }), { plan: 'studio', method: 'card', months: 1, from: 'assinatura' })
    assert.deepEqual(parseCheckoutInput({ plan: 'salao', method: 'pix', months: 3 }), { plan: 'salao', method: 'pix', months: 3, from: 'assinatura' })
    assert.equal(parseCheckoutInput({ plan: 'solo', method: 'card', from: 'onboarding' }).from, 'onboarding')
  })
  it('rejeita plano, forma e período inválidos', () => {
    assert.throws(() => parseCheckoutInput({ plan: 'gratis', method: 'card' }), HttpError)
    assert.throws(() => parseCheckoutInput({ plan: 'solo', method: 'boleto' }), HttpError)
    assert.throws(() => parseCheckoutInput({ plan: 'solo', method: 'pix', months: 2 }), HttpError)
    // 12 meses não existe mais (a landing só tem mensal e trimestral)
    assert.throws(() => parseCheckoutInput({ plan: 'solo', method: 'pix', months: 12 }), HttpError)
    assert.throws(() => parseCheckoutInput(null), HttpError)
  })
  it('ignora "months" no cartão', () => {
    assert.equal(parseCheckoutInput({ plan: 'solo', method: 'card', months: 3 }).months, 1)
  })
})

// ---------------------------------------------------------------- checkout

describe('createCheckout', () => {
  it('Pix: sessão de pagamento único com o valor de N meses e metadados', async () => {
    const { db, calls } = fakeDb()
    const { stripe, created } = fakeStripe()
    const out = await createCheckout(deps(db, stripe), user, { plan: 'studio', method: 'pix', months: 3, from: 'assinatura' })
    assert.equal(out.url, 'https://checkout.stripe.test/session')
    const s = created[0] as Record<string, any>
    assert.equal(s.mode, 'payment')
    assert.deepEqual(s.allowed_payment_method_types, ['pix'])
    assert.equal(s.line_items[0].price_data.currency, 'brl')
    assert.equal(s.line_items[0].price_data.unit_amount, 7625) // 3 meses com 15% de desconto
    assert.deepEqual(s.metadata, { kind: 'pix_prepaid', salon_id: 'salon-1', plan: 'studio', months: '3' })
    assert.equal(s.customer, 'cus_new_1')
    assert.deepEqual(calls.setCustomerId, ['cus_new_1'])
  })

  it('não troca para um plano em que a equipe não cabe (R-106)', async () => {
    const { db } = fakeDb({ team: { professionals: 2, members: 2 } })
    const { stripe, created } = fakeStripe()
    await assert.rejects(createCheckout(deps(db, stripe), user, { plan: 'solo', method: 'pix', months: 1, from: 'assinatura' }), (e: HttpError) => e.code === 'team_too_big')
    assert.equal(created.length, 0)
    await createCheckout(deps(db, stripe), user, { plan: 'studio', method: 'pix', months: 1, from: 'assinatura' })
    assert.equal(created.length, 1)
  })

  it('cartão durante o teste: assinatura que preserva os dias que sobraram', async () => {
    const { db } = fakeDb()
    const { stripe, created } = fakeStripe()
    await createCheckout(deps(db, stripe), user, { plan: 'solo', method: 'card', months: 1, from: 'assinatura' })
    const s = created[0] as Record<string, any>
    assert.equal(s.mode, 'subscription')
    assert.deepEqual(s.allowed_payment_method_types, ['card'])
    assert.equal(s.line_items[0].price, 'price_ikizy_solo_monthly')
    assert.equal(s.subscription_data.trial_end, Math.floor((NOW.getTime() + 20 * DAY) / 1000))
    assert.equal(s.subscription_data.metadata.salon_id, 'salon-1')
  })

  it('cartão em outro plano durante o teste: também preserva os dias que sobraram', async () => {
    const { stripe, created } = fakeStripe()
    await createCheckout(deps(fakeDb().db, stripe), user, { plan: 'studio', method: 'card', months: 1, from: 'assinatura' })
    assert.equal((created[0] as any).subscription_data.trial_end, Math.floor((NOW.getTime() + 20 * DAY) / 1000))
  })

  it('cartão: sem trial_end quando faltam menos de 49 h ou fora do teste', async () => {
    const soon = fakeDb({ sub: { trialEndsAt: new Date(NOW.getTime() + 30 * 60 * 60 * 1000) } })
    const a = fakeStripe()
    await createCheckout(deps(soon.db, a.stripe), user, { plan: 'solo', method: 'card', months: 1, from: 'assinatura' })
    assert.equal((a.created[0] as any).subscription_data.trial_end, undefined)

    const b = fakeStripe()
    await createCheckout(deps(fakeDb({ sub: { status: 'active', billingMethod: 'pix' } }).db, b.stripe), user, { plan: 'studio', method: 'card', months: 1, from: 'assinatura' })
    assert.equal((b.created[0] as any).subscription_data.trial_end, undefined)
  })

  it('volta para o passo de plano quando veio do cadastro', async () => {
    const { stripe, created } = fakeStripe()
    await createCheckout(deps(fakeDb().db, stripe), user, { plan: 'salao', method: 'card', months: 1, from: 'onboarding' })
    const s = created[0] as any
    assert.match(s.success_url, /\/cadastro\/plano\?retorno=ok$/)
    assert.match(s.cancel_url, /\/cadastro\/plano\?retorno=cancelado$/)
    const c = fakeStripe()
    await createCheckout(deps(fakeDb().db, c.stripe), user, { plan: 'salao', method: 'card', months: 1, from: 'assinatura' })
    assert.match((c.created[0] as any).success_url, /\/dashboard\/assinatura\?retorno=ok$/)
  })

  it('reaproveita o cliente do Stripe já salvo', async () => {
    const { db, calls } = fakeDb({ sub: { stripeCustomerId: 'cus_old' } })
    const { stripe, created } = fakeStripe()
    await createCheckout(deps(db, stripe), user, { plan: 'solo', method: 'pix', months: 1, from: 'assinatura' })
    assert.equal((created[0] as any).customer, 'cus_old')
    assert.equal(calls.setCustomerId.length, 0)
  })

  it('só a dona paga', async () => {
    const { db } = fakeDb({ member: { salonId: 'salon-1', salonName: 'X', role: 'reception' } })
    await rejects(createCheckout(deps(db, fakeStripe().stripe), user, { plan: 'solo', method: 'card', months: 1, from: 'assinatura' }), 403, 'not_owner')
  })

  it('sem negócio ou sem assinatura', async () => {
    await rejects(createCheckout(deps(fakeDb({ member: null }).db, fakeStripe().stripe), user, { plan: 'solo', method: 'card', months: 1, from: 'assinatura' }), 404, 'no_salon')
    await rejects(createCheckout(deps(fakeDb({ sub: null }).db, fakeStripe().stripe), user, { plan: 'solo', method: 'card', months: 1, from: 'assinatura' }), 404, 'no_subscription')
  })

  it('assinatura de cartão ativa: manda para o portal em vez de cobrar em dobro', async () => {
    const { db } = fakeDb({ sub: { status: 'active', billingMethod: 'card', stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_1' } })
    await rejects(createCheckout(deps(db, fakeStripe().stripe), user, { plan: 'studio', method: 'card', months: 1, from: 'assinatura' }), 409, 'use_portal')
    await rejects(createCheckout(deps(db, fakeStripe().stripe), user, { plan: 'studio', method: 'pix', months: 1, from: 'assinatura' }), 409, 'use_portal')
  })

  it('quem já assinou no cartão durante o teste (trialing) também vai para o portal', async () => {
    const { db } = fakeDb({ sub: { status: 'trialing', billingMethod: 'card', stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_1' } })
    await rejects(createCheckout(deps(db, fakeStripe().stripe), user, { plan: 'studio', method: 'card', months: 1, from: 'assinatura' }), 409, 'use_portal')
  })

  it('assinatura de cartão já cancelada para o fim do período pode assinar de novo', async () => {
    const { db } = fakeDb({ sub: { status: 'active', billingMethod: 'card', stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_1', cancelAtPeriodEnd: true } })
    const { stripe, created } = fakeStripe()
    await createCheckout(deps(db, stripe), user, { plan: 'studio', method: 'pix', months: 1, from: 'assinatura' })
    assert.equal(created.length, 1)
  })
})

describe('changePlan', () => {
  const liveCard = { plan: 'studio' as const, status: 'active' as const, billingMethod: 'card' as const, stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' }
  const planStripe = () => {
    const updates: Record<string, unknown>[] = []
    const stripe = {
      subscriptions: {
        retrieve: async () => ({ id: 'sub_1', metadata: { salon_id: 'salon-1', plan: 'studio' }, items: { data: [{ id: 'si_1' }] } }),
        update: async (_id: string, params: Record<string, unknown>) => void updates.push(params),
      },
      prices: { list: async ({ lookup_keys }: { lookup_keys: string[] }) => ({ data: [{ id: `price_${lookup_keys[0]}` }] }) },
    } as unknown as Stripe
    return { stripe, updates }
  }
  const code = (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof HttpError ? e.code : 'outro'))

  it('subir cobra a diferença na hora e grava o plano nos metadados', async () => {
    const { db } = fakeDb({ sub: liveCard })
    const { stripe, updates } = planStripe()
    assert.deepEqual(await changePlan(deps(db, stripe), user, 'salao'), { plan: 'salao', upgrade: true })
    assert.equal(updates[0].proration_behavior, 'always_invoice')
    assert.deepEqual(updates[0].items, [{ id: 'si_1', price: 'price_ikizy_salao_monthly' }])
    assert.equal((updates[0].metadata as Record<string, string>).plan, 'salao')
  })

  it('descer não cobra nada agora: vale na próxima cobrança', async () => {
    const { db } = fakeDb({ sub: liveCard })
    const { stripe, updates } = planStripe()
    await changePlan(deps(db, stripe), user, 'solo')
    assert.equal(updates[0].proration_behavior, 'none')
  })

  it('não desce para um plano em que a equipe não cabe (o portal deixava)', async () => {
    const { db } = fakeDb({ sub: liveCard, team: { professionals: 3, members: 2 } })
    const { stripe, updates } = planStripe()
    assert.equal(await code(changePlan(deps(db, stripe), user, 'solo')), 'team_too_big')
    assert.equal(updates.length, 0)
  })

  it('só a dona, só com cartão ativo e só para outro plano', async () => {
    const { stripe } = planStripe()
    assert.equal(await code(changePlan(deps(fakeDb({ sub: liveCard, member: { salonId: 'salon-1', salonName: 'X', role: 'manager' } }).db, stripe), user, 'salao')), 'not_owner')
    assert.equal(await code(changePlan(deps(fakeDb({ sub: { ...liveCard, billingMethod: 'pix' } }).db, stripe), user, 'salao')), 'no_card_subscription')
    assert.equal(await code(changePlan(deps(fakeDb({ sub: { ...liveCard, cancelAtPeriodEnd: true } }).db, stripe), user, 'salao')), 'no_card_subscription')
    assert.equal(await code(changePlan(deps(fakeDb({ sub: liveCard }).db, stripe), user, 'studio')), 'same_plan')
  })
})

describe('createPortal', () => {
  it('abre o portal para quem já tem cliente no Stripe', async () => {
    const { db } = fakeDb({ sub: { stripeCustomerId: 'cus_1' } })
    assert.equal((await createPortal(deps(db, fakeStripe().stripe), user)).url, 'https://portal.stripe.test/session')
  })
  it('sem pagamentos ainda, não há o que gerenciar', async () => {
    await rejects(createPortal(deps(fakeDb().db, fakeStripe().stripe), user), 404, 'no_customer')
  })
})

// ---------------------------------------------------------------- webhook

const ev = (type: string, object: unknown, created = 1_800_000_000) => ({ id: 'evt_1', type, created, data: { object } }) as unknown as Stripe.Event

const pixSession = (over: Record<string, unknown> = {}) => ({
  id: 'cs_1',
  mode: 'payment',
  payment_status: 'paid',
  customer: 'cus_1',
  metadata: { kind: 'pix_prepaid', salon_id: 'salon-1', plan: 'studio', months: '3' },
  ...over,
})

describe('handleStripeEvent · Pix', () => {
  it('Pix pago soma os meses uma vez, mesmo com os dois eventos do Stripe', async () => {
    const { db, calls } = fakeDb()
    await handleStripeEvent(ev('checkout.session.completed', pixSession()), db)
    await handleStripeEvent(ev('checkout.session.async_payment_succeeded', pixSession()), db)
    assert.equal(calls.pix.length, 1)
    assert.deepEqual({ ...calls.pix[0] }, {
      key: 'pix:cs_1',
      type: 'checkout.session.completed',
      salonId: 'salon-1',
      plan: 'studio',
      months: 3,
      customerId: 'cus_1',
    })
  })

  it('Pix ainda não pago não libera acesso', async () => {
    const { db, calls } = fakeDb()
    await handleStripeEvent(ev('checkout.session.completed', pixSession({ payment_status: 'unpaid' })), db)
    assert.equal(calls.pix.length, 0)
  })

  it('metadados inválidos são ignorados', async () => {
    const { db, calls } = fakeDb()
    await handleStripeEvent(ev('checkout.session.completed', pixSession({ metadata: { kind: 'pix_prepaid', salon_id: 'salon-1', plan: 'vip', months: '3' } })), db)
    await handleStripeEvent(ev('checkout.session.completed', pixSession({ metadata: { kind: 'pix_prepaid', salon_id: 'salon-1', plan: 'solo', months: '7' } })), db)
    assert.equal(calls.pix.length, 0)
  })

  it('checkout de assinatura só registra o cliente', async () => {
    const { db, calls } = fakeDb()
    await handleStripeEvent(ev('checkout.session.completed', { id: 'cs_2', mode: 'subscription', customer: 'cus_7', metadata: { salon_id: 'salon-1' } }), db)
    assert.deepEqual(calls.setCustomerId, ['cus_7'])
    assert.equal(calls.pix.length, 0)
  })
})

const subscription = (over: Record<string, unknown> = {}) => ({
  id: 'sub_1',
  status: 'active',
  customer: 'cus_1',
  cancel_at_period_end: false,
  metadata: { salon_id: 'salon-1', plan: 'studio' },
  items: { data: [{ current_period_end: 1_800_000_000, price: { lookup_key: 'ikizy_studio_monthly' } }] },
  ...over,
})

describe('handleStripeEvent · assinatura no cartão', () => {
  it('ativa: acesso até o fim do período + tolerância', async () => {
    const { db, calls } = fakeDb()
    await handleStripeEvent(ev('customer.subscription.updated', subscription()), db)
    const s = calls.subs[0]
    assert.equal(s.status, 'active')
    assert.equal(s.plan, 'studio')
    assert.equal(s.onlyShrink, false)
    assert.equal(s.accessUntil.getTime(), 1_800_000_000 * 1000 + 2 * DAY)
    assert.equal(s.subscriptionId, 'sub_1')
  })

  it('cobrança falhou: past_due; cancelamento agendado fica registrado', async () => {
    const { db, calls } = fakeDb()
    await handleStripeEvent(ev('customer.subscription.updated', subscription({ status: 'past_due', cancel_at_period_end: true })), db)
    assert.equal(calls.subs[0].status, 'past_due')
    assert.equal(calls.subs[0].cancelAtPeriodEnd, true)
  })

  it('cancelada: o acesso só pode diminuir', async () => {
    const { db, calls } = fakeDb()
    await handleStripeEvent(ev('customer.subscription.deleted', subscription({ status: 'canceled' })), db)
    assert.equal(calls.subs[0].status, 'canceled')
    assert.equal(calls.subs[0].onlyShrink, true)
  })

  it('incomplete não libera acesso', async () => {
    const { db, calls } = fakeDb()
    await handleStripeEvent(ev('customer.subscription.created', subscription({ status: 'incomplete' })), db)
    assert.equal(calls.subs.length, 0)
  })

  it('acha o salão pelo cliente quando faltam metadados; ignora se não achar', async () => {
    const { db, calls } = fakeDb()
    await handleStripeEvent(ev('customer.subscription.updated', subscription({ customer: 'cus_known', metadata: {} })), db)
    assert.equal(calls.subs[0].salonId, 'salon-9')
    assert.equal(calls.subs[0].plan, 'studio') // vem do lookup_key do preço
    await handleStripeEvent(ev('customer.subscription.updated', subscription({ customer: 'cus_unknown', metadata: {} })), db)
    assert.equal(calls.subs.length, 1)
  })

  it('lê o fim do período no item (API nova) ou na assinatura (API antiga)', () => {
    assert.equal(subscriptionPeriodEnd(subscription() as unknown as Stripe.Subscription), 1_800_000_000)
    assert.equal(subscriptionPeriodEnd({ current_period_end: 5, items: { data: [{}] } } as unknown as Stripe.Subscription), 5)
  })

  it('eventos desconhecidos são ignorados', async () => {
    const { db, calls } = fakeDb()
    await handleStripeEvent(ev('charge.refunded', {}), db)
    assert.equal(calls.subs.length + calls.pix.length, 0)
  })
})

// ---------------------------------------------------------------- conferência diária com o Stripe

/** Stripe falso para a conferência: assinaturas por id, listagens paginadas de 1 em 1 */
function reconcileStripeFake(opts: { known?: Record<string, unknown>; recent?: Record<string, unknown>[]; sessions?: Record<string, unknown>[]; failRetrieve?: string } = {}) {
  const listCalls: Record<string, unknown>[] = []
  const paged = (items: Record<string, unknown>[]) => async (params: { starting_after?: string; created?: { gte: number } }) => {
    listCalls.push(params)
    const start = params.starting_after ? items.findIndex((x) => x.id === params.starting_after) + 1 : 0
    return { data: items.slice(start, start + 1), has_more: start + 1 < items.length }
  }
  return {
    listCalls,
    stripe: {
      subscriptions: {
        retrieve: async (id: string) => {
          if (id === opts.failRetrieve) throw new Error('stripe fora do ar')
          return opts.known?.[id]
        },
        list: paged(opts.recent ?? []),
      },
      checkout: { sessions: { list: paged(opts.sessions ?? []) } },
    } as unknown as Stripe,
  }
}

const reconcileDb = (known: string[] = []) => {
  const { db, calls } = fakeDb()
  return { db: { ...db, knownCardSubscriptions: async () => known } satisfies ReconcileDb, calls }
}

describe('reconcileStripe', () => {
  it('reaplica as assinaturas que o banco conhece com o estado atual do Stripe', async () => {
    const { db, calls } = reconcileDb(['sub_1'])
    const { stripe } = reconcileStripeFake({ known: { sub_1: subscription({ status: 'past_due' }) } })
    const r = await reconcileStripe({ db, stripe, now: NOW })
    assert.equal(r.subscriptions, 1)
    assert.equal(calls.subs[0].status, 'past_due')
    assert.equal(calls.subs[0].eventAt.getTime(), NOW.getTime())
  })

  it('pega assinaturas novas cujo webhook se perdeu, sem aplicar a mesma duas vezes', async () => {
    const { db, calls } = reconcileDb(['sub_1'])
    const { stripe } = reconcileStripeFake({
      known: { sub_1: subscription() },
      recent: [subscription(), subscription({ id: 'sub_2', metadata: { salon_id: 'salon-2', plan: 'solo' } })],
    })
    const r = await reconcileStripe({ db, stripe, now: NOW })
    assert.deepEqual(calls.subs.map((s) => s.subscriptionId), ['sub_1', 'sub_2'])
    assert.equal(r.subscriptions, 2)
  })

  it('Pix pago que não chegou pelo webhook soma os meses; o que já chegou não soma de novo', async () => {
    const { db, calls } = reconcileDb()
    // o webhook já aplicou cs_1 (mesma chave), o cs_3 se perdeu
    await db.applyPixPayment({ key: 'pix:cs_1', type: 'checkout.session.completed', salonId: 'salon-1', plan: 'studio', months: 3, customerId: 'cus_1' })
    const { stripe } = reconcileStripeFake({
      sessions: [pixSession(), pixSession({ id: 'cs_3', metadata: { kind: 'pix_prepaid', salon_id: 'salon-3', plan: 'solo', months: '1' } })],
    })
    const r = await reconcileStripe({ db, stripe, now: NOW })
    assert.equal(r.pix, 1)
    assert.deepEqual(calls.pix.map((p) => p.key), ['pix:cs_1', 'pix:cs_3'])
    assert.equal(calls.pix[1].type, 'reconcile')
  })

  it('ignora sessões que não são Pix pago e conta as que têm metadados ruins', async () => {
    const { db, calls } = reconcileDb()
    const { stripe } = reconcileStripeFake({
      sessions: [
        pixSession({ id: 'cs_a', payment_status: 'unpaid' }),
        { id: 'cs_b', mode: 'subscription', metadata: { kind: 'card_subscription' } },
        pixSession({ id: 'cs_c', metadata: { kind: 'pix_prepaid', salon_id: 'salon-1', plan: 'vip', months: '3' } }),
      ],
    })
    const r = await reconcileStripe({ db, stripe, now: NOW })
    assert.equal(calls.pix.length, 0)
    assert.equal(r.skipped, 1)
  })

  it('olha só os últimos dias e uma falha no Stripe não para o resto', async () => {
    const { db, calls } = reconcileDb(['sub_x', 'sub_1'])
    const { stripe, listCalls } = reconcileStripeFake({ known: { sub_1: subscription() }, failRetrieve: 'sub_x' })
    const r = await reconcileStripe({ db, stripe, now: NOW })
    assert.equal(r.errors, 1)
    assert.equal(calls.subs.length, 1)
    assert.equal((listCalls[0].created as { gte: number }).gte, Math.floor((NOW.getTime() - 3 * DAY) / 1000))
  })
})

// ---------------------------------------------------------------- regras de acesso

const info = (over: Partial<SubscriptionInfo> = {}): SubscriptionInfo => ({
  plan: 'solo',
  status: 'trialing',
  trialEndsAt: null,
  accessUntil: new Date(NOW.getTime() + 20 * DAY),
  method: null,
  cancelAtPeriodEnd: false,
  hasCustomer: false,
  planChosen: true,
  ...over,
})

describe('accessState', () => {
  it('teste, ativo, terminando, em atraso e expirado', () => {
    assert.equal(accessState(info(), NOW), 'trial')
    assert.equal(accessState(info({ status: 'active', method: 'card' }), NOW), 'active')
    assert.equal(accessState(info({ status: 'active', method: 'pix', accessUntil: new Date(NOW.getTime() + 5 * DAY) }), NOW), 'ending')
    assert.equal(accessState(info({ status: 'active', method: 'pix', accessUntil: new Date(NOW.getTime() + 40 * DAY) }), NOW), 'active')
    assert.equal(accessState(info({ status: 'active', method: 'card', cancelAtPeriodEnd: true, accessUntil: new Date(NOW.getTime() + 3 * DAY) }), NOW), 'ending')
    assert.equal(accessState(info({ status: 'past_due', method: 'card' }), NOW), 'past_due')
    assert.equal(accessState(info({ accessUntil: new Date(NOW.getTime() - 1000) }), NOW), 'expired')
  })
  it('assinar no cartão durante o teste vira assinatura ativa, com 1ª cobrança no fim do teste', () => {
    const until = new Date(NOW.getTime() + 22 * DAY)
    const s = info({ status: 'trialing', method: 'card', accessUntil: until })
    assert.equal(isCardTrial(s), true)
    assert.equal(accessState(s, NOW), 'active')
    assert.equal(periodEnd(s).getTime(), until.getTime() - 2 * DAY)
    assert.match(describeSubscription(s, NOW), /^Solo · assinatura ativa, 1ª cobrança em \d\d\/\d\d$/)
    assert.equal(isCardTrial(info()), false) // teste sem cartão continua sendo teste
    assert.equal(accessState(info(), NOW), 'trial')
  })
  it('daysLeft arredonda para cima e nunca fica negativo', () => {
    assert.equal(daysLeft(new Date(NOW.getTime() + 1.2 * DAY), NOW), 2)
    assert.equal(daysLeft(new Date(NOW.getTime() - DAY), NOW), 0)
  })
  it('periodEnd desconta a tolerância só no cartão', () => {
    const until = new Date(NOW.getTime() + 10 * DAY)
    assert.equal(periodEnd(info({ status: 'active', method: 'card', accessUntil: until })).getTime(), until.getTime() - 2 * DAY)
    assert.equal(periodEnd(info({ status: 'active', method: 'pix', accessUntil: until })).getTime(), until.getTime())
  })
  it('parseSubscription lê a linha do banco', () => {
    const parsed = parseSubscription({ plan: 'salao', status: 'active', access_until: '2026-11-01T00:00:00Z', billing_method: 'pix', stripe_customer_id: 'cus_1', cancel_at_period_end: false, trial_ends_at: null })
    assert.equal(parsed?.plan, 'salao')
    assert.equal(parsed?.method, 'pix')
    assert.equal(parsed?.hasCustomer, true)
    assert.equal(parsed?.planChosen, false) // ainda não passou pela escolha de plano do cadastro
    const chosen = parseSubscription({ plan: 'solo', status: 'trialing', access_until: '2026-11-01T00:00:00Z', plan_chosen_at: '2026-10-09T12:00:00Z' })
    assert.equal(chosen?.planChosen, true)
    assert.equal(parseSubscription({ plan: 'x' }), null)
  })
  it('describeSubscription resume o plano em uma linha', () => {
    assert.equal(describeSubscription(info(), NOW), 'Solo · teste grátis, restam 20 dias')
    assert.equal(describeSubscription(info({ accessUntil: new Date(NOW.getTime() + 0.5 * DAY) }), NOW), 'Solo · teste grátis, resta 1 dia')
    assert.equal(describeSubscription(info({ plan: 'studio', status: 'active', method: 'card' }), NOW).startsWith('Studio · renova em '), true)
    assert.equal(describeSubscription(info({ plan: 'salao', status: 'active', method: 'pix', accessUntil: new Date(NOW.getTime() + 60 * DAY) }), NOW).startsWith('Salão · Pix, acesso até '), true)
    assert.equal(describeSubscription(info({ status: 'past_due', method: 'card' }), NOW), 'Solo · pagamento pendente')
    assert.equal(describeSubscription(info({ accessUntil: new Date(NOW.getTime() - 1000) }), NOW), 'Solo · acesso encerrado')
  })
  it('preços em centavos', () => {
    assert.equal(pixAmountCents('salao', 1), 5990)
  })
  it('Pix de 3 meses tem 15% de desconto, sempre em centavos inteiros', () => {
    assert.equal(pixFullCents('studio', 3), 8970)
    assert.equal(pixAmountCents('solo', 3), 2525)
    assert.equal(pixAmountCents('studio', 3), 7625)
    assert.equal(pixAmountCents('salao', 3), 15275)
  })
  it('Pix de 1 e 3 meses: valor cheio e com 15% de desconto, sempre em centavos inteiros', () => {
    assert.equal(pixFullCents('solo', 3), 2970)
    assert.equal(pixAmountCents('solo', 1), 990)
    for (const p of ['solo', 'studio', 'salao'] as const) {
      for (const m of PIX_MONTHS) assert.ok(Number.isInteger(pixAmountCents(p, m)))
    }
  })
})

// ---------------------------------------------------------------- landing x cobrança

describe('preços da landing', () => {
  it('batem com os preços cobrados no app, em todos os planos e períodos', () => {
    assert.deepEqual([...LANDING_MONTHS], [...PIX_MONTHS])
    assert.deepEqual(LANDING_DISCOUNT, PIX_DISCOUNT_PCT)
    assert.equal(LANDING_TRIAL_DAYS, TRIAL_DAYS)
    for (const lp of LANDING_PLANS) {
      assert.equal(lp.cents, PLANS[lp.id].cents, lp.id)
      for (const m of PIX_MONTHS) assert.equal(pixTotalCents(lp.cents, m), pixAmountCents(lp.id, m), lp.id + ' ' + m)
    }
  })
})

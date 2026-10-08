import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type Stripe from 'stripe'
import {
  HttpError,
  createCheckout,
  createPortal,
  handleStripeEvent,
  parseCheckoutInput,
  subscriptionPeriodEnd,
  type BillingDb,
  type Membership,
  type SubscriptionRow,
} from './billing.js'
import { PLANS as LANDING_PLANS, PIX_DISCOUNT_PCT as LANDING_DISCOUNT, PIX_MONTHS as LANDING_MONTHS, pixTotalCents } from '../../../landing/src/lib/pricing.js'
import { canAddProfessional, isCardTrial, PIX_DISCOUNT_PCT, PIX_MONTHS, PLAN_IDS, PLANS, accessState, daysLeft, describeSubscription, parseSubscription, periodEnd, pixAmountCents, pixFullCents, planForProfessionals, type SubscriptionInfo } from '../../src/lib/plans.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-10T12:00:00Z')

// ---------------------------------------------------------------- fakes

function fakeDb(opts: { member?: Membership | null; sub?: Partial<SubscriptionRow> | null } = {}) {
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
    assert.deepEqual(parseCheckoutInput({ plan: 'studio', method: 'card' }), { plan: 'studio', method: 'card', months: 1 })
    assert.deepEqual(parseCheckoutInput({ plan: 'salao', method: 'pix', months: 12 }), { plan: 'salao', method: 'pix', months: 12 })
  })
  it('rejeita plano, forma e período inválidos', () => {
    assert.throws(() => parseCheckoutInput({ plan: 'gratis', method: 'card' }), HttpError)
    assert.throws(() => parseCheckoutInput({ plan: 'solo', method: 'boleto' }), HttpError)
    assert.throws(() => parseCheckoutInput({ plan: 'solo', method: 'pix', months: 2 }), HttpError)
    assert.throws(() => parseCheckoutInput(null), HttpError)
  })
  it('ignora "months" no cartão', () => {
    assert.equal(parseCheckoutInput({ plan: 'solo', method: 'card', months: 12 }).months, 1)
  })
})

// ---------------------------------------------------------------- checkout

describe('createCheckout', () => {
  it('Pix: sessão de pagamento único com o valor de N meses e metadados', async () => {
    const { db, calls } = fakeDb()
    const { stripe, created } = fakeStripe()
    const out = await createCheckout(deps(db, stripe), user, { plan: 'studio', method: 'pix', months: 3 })
    assert.equal(out.url, 'https://checkout.stripe.test/session')
    const s = created[0] as Record<string, any>
    assert.equal(s.mode, 'payment')
    assert.deepEqual(s.allowed_payment_method_types, ['pix'])
    assert.equal(s.line_items[0].price_data.currency, 'brl')
    assert.equal(s.line_items[0].price_data.unit_amount, 2990 * 3)
    // 12 meses: o servidor cobra o valor com desconto
    await createCheckout(deps(fakeDb().db, stripe), user, { plan: 'studio', method: 'pix', months: 12 })
    assert.equal((created[1] as Record<string, any>).line_items[0].price_data.unit_amount, 34086)
    assert.deepEqual(s.metadata, { kind: 'pix_prepaid', salon_id: 'salon-1', plan: 'studio', months: '3' })
    assert.equal(s.customer, 'cus_new_1')
    assert.deepEqual(calls.setCustomerId, ['cus_new_1'])
  })

  it('cartão no Solo durante o teste: assinatura que preserva os dias que sobraram', async () => {
    const { db } = fakeDb()
    const { stripe, created } = fakeStripe()
    await createCheckout(deps(db, stripe), user, { plan: 'solo', method: 'card', months: 1 })
    const s = created[0] as Record<string, any>
    assert.equal(s.mode, 'subscription')
    assert.deepEqual(s.allowed_payment_method_types, ['card'])
    assert.equal(s.line_items[0].price, 'price_ikizy_solo_monthly')
    assert.equal(s.subscription_data.trial_end, Math.floor((NOW.getTime() + 20 * DAY) / 1000))
    assert.equal(s.subscription_data.metadata.salon_id, 'salon-1')
  })

  it('cartão: sem trial_end quando faltam menos de 49 h', async () => {
    const soon = fakeDb({ sub: { trialEndsAt: new Date(NOW.getTime() + 30 * 60 * 60 * 1000) } })
    const a = fakeStripe()
    await createCheckout(deps(soon.db, a.stripe), user, { plan: 'solo', method: 'card', months: 1 })
    assert.equal((a.created[0] as any).subscription_data.trial_end, undefined)
  })

  it('cartão: todo plano preserva os dias de teste que sobraram', async () => {
    for (const plan of ['studio', 'salao'] as const) {
      const b = fakeStripe()
      await createCheckout(deps(fakeDb().db, b.stripe), user, { plan, method: 'card', months: 1 })
      assert.equal((b.created[0] as any).subscription_data.trial_end, Math.floor((NOW.getTime() + 20 * DAY) / 1000), plan)
    }
  })

  it('cartão: sem trial_end para quem não está em teste', async () => {
    const paid = fakeDb({ sub: { status: 'canceled' } })
    const c = fakeStripe()
    await createCheckout(deps(paid.db, c.stripe), user, { plan: 'studio', method: 'card', months: 1 })
    assert.equal((c.created[0] as any).subscription_data.trial_end, undefined)
  })

  it('reaproveita o cliente do Stripe já salvo', async () => {
    const { db, calls } = fakeDb({ sub: { stripeCustomerId: 'cus_old' } })
    const { stripe, created } = fakeStripe()
    await createCheckout(deps(db, stripe), user, { plan: 'solo', method: 'pix', months: 1 })
    assert.equal((created[0] as any).customer, 'cus_old')
    assert.equal(calls.setCustomerId.length, 0)
  })

  it('só a dona paga', async () => {
    const { db } = fakeDb({ member: { salonId: 'salon-1', salonName: 'X', role: 'reception' } })
    await rejects(createCheckout(deps(db, fakeStripe().stripe), user, { plan: 'solo', method: 'card', months: 1 }), 403, 'not_owner')
  })

  it('sem negócio ou sem assinatura', async () => {
    await rejects(createCheckout(deps(fakeDb({ member: null }).db, fakeStripe().stripe), user, { plan: 'solo', method: 'card', months: 1 }), 404, 'no_salon')
    await rejects(createCheckout(deps(fakeDb({ sub: null }).db, fakeStripe().stripe), user, { plan: 'solo', method: 'card', months: 1 }), 404, 'no_subscription')
  })

  it('assinatura de cartão ativa: manda para o portal em vez de cobrar em dobro', async () => {
    const { db } = fakeDb({ sub: { status: 'active', billingMethod: 'card', stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_1' } })
    await rejects(createCheckout(deps(db, fakeStripe().stripe), user, { plan: 'studio', method: 'card', months: 1 }), 409, 'use_portal')
    await rejects(createCheckout(deps(db, fakeStripe().stripe), user, { plan: 'studio', method: 'pix', months: 1 }), 409, 'use_portal')
  })

  it('quem já assinou no cartão durante o teste (trialing) também vai para o portal', async () => {
    const { db } = fakeDb({ sub: { status: 'trialing', billingMethod: 'card', stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_1' } })
    await rejects(createCheckout(deps(db, fakeStripe().stripe), user, { plan: 'studio', method: 'card', months: 1 }), 409, 'use_portal')
  })

  it('assinatura de cartão já cancelada para o fim do período pode assinar de novo', async () => {
    const { db } = fakeDb({ sub: { status: 'active', billingMethod: 'card', stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_1', cancelAtPeriodEnd: true } })
    const { stripe, created } = fakeStripe()
    await createCheckout(deps(db, stripe), user, { plan: 'studio', method: 'pix', months: 1 })
    assert.equal(created.length, 1)
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

// ---------------------------------------------------------------- regras de acesso

const info = (over: Partial<SubscriptionInfo> = {}): SubscriptionInfo => ({
  plan: 'solo',
  status: 'trialing',
  trialEndsAt: null,
  accessUntil: new Date(NOW.getTime() + 20 * DAY),
  method: null,
  cancelAtPeriodEnd: false,
  hasCustomer: false,
  courtesy: false,
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
    assert.equal(parseSubscription({ plan: 'x' }), null)
  })
  it('describeSubscription resume o plano em uma linha', () => {
    assert.equal(describeSubscription(info(), NOW), 'Solo · teste grátis, restam 20 dias')
    assert.equal(describeSubscription(info({ accessUntil: new Date(NOW.getTime() + 0.5 * DAY) }), NOW), 'Solo · teste grátis, resta 1 dia')
    assert.equal(describeSubscription(info({ plan: 'studio', status: 'active', method: 'card' }), NOW).startsWith('Studio · renova em '), true)
    assert.equal(describeSubscription(info({ plan: 'salao', status: 'active', method: 'pix', accessUntil: new Date(NOW.getTime() + 60 * DAY) }), NOW).startsWith('Salão · Pix, acesso até '), true)
    assert.equal(describeSubscription(info({ status: 'past_due', method: 'card' }), NOW), 'Solo · pagamento pendente')
    assert.equal(describeSubscription(info({ accessUntil: new Date(NOW.getTime() - 1000) }), NOW), 'Solo · acesso encerrado')
    assert.equal(describeSubscription(info({ plan: 'salao', courtesy: true }), NOW).startsWith('Salão · cortesia até '), true)
  })
  it('cortesia: não cobra nem avisa enquanto durar; vencida, vira só leitura', () => {
    assert.equal(accessState(info({ courtesy: true, accessUntil: new Date(NOW.getTime() + 2 * DAY) }), NOW), 'courtesy')
    assert.equal(accessState(info({ courtesy: true, accessUntil: new Date(NOW.getTime() - 1000) }), NOW), 'expired')
    assert.equal(parseSubscription({ plan: 'salao', status: 'trialing', access_until: '2027-01-01T00:00:00Z', courtesy: true })?.courtesy, true)
  })
  it('limite de profissionais por plano: Solo 1, Studio até 4, Salão sem limite', () => {
    assert.equal(canAddProfessional('solo', 0), true)
    assert.equal(canAddProfessional('solo', 1), false)
    assert.equal(canAddProfessional('studio', 3), true)
    assert.equal(canAddProfessional('studio', 4), false)
    assert.equal(canAddProfessional('salao', 50), true)
    assert.equal(planForProfessionals(1), 'solo')
    assert.equal(planForProfessionals(4), 'studio')
    assert.equal(planForProfessionals(5), 'salao')
  })
  it('todos os planos têm teste grátis', () => {
    for (const id of PLAN_IDS) assert.equal(PLANS[id].trialDays, 30, id)
  })
  it('preços em centavos', () => {
    assert.equal(pixAmountCents('salao', 1), 5990)
    assert.equal(pixAmountCents('studio', 3), 2990 * 3) // 3 meses sem desconto
  })
  it('Pix de 12 meses tem 5% de desconto, sempre em centavos inteiros', () => {
    assert.equal(pixFullCents('solo', 12), 11880)
    assert.equal(pixAmountCents('solo', 12), 11286)
    assert.equal(pixAmountCents('studio', 12), 34086)
    assert.equal(pixAmountCents('salao', 12), 68286)
    for (const p of ['solo', 'studio', 'salao'] as const) assert.ok(Number.isInteger(pixAmountCents(p, 12)))
  })
})

// ---------------------------------------------------------------- landing x cobrança

describe('preços da landing', () => {
  it('batem com os preços cobrados no app, em todos os planos e períodos', () => {
    assert.deepEqual([...LANDING_MONTHS], [...PIX_MONTHS])
    assert.deepEqual(LANDING_DISCOUNT, PIX_DISCOUNT_PCT)
    for (const lp of LANDING_PLANS) {
      assert.equal(lp.cents, PLANS[lp.id].cents, lp.id)
      for (const m of PIX_MONTHS) assert.equal(pixTotalCents(lp.cents, m), pixAmountCents(lp.id, m), lp.id + ' ' + m)
    }
  })
})

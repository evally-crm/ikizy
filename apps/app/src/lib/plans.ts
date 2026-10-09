/**
 * Planos e regras de acesso. Este arquivo é usado pelo navegador E pelas funções de servidor (api/),
 * então não pode importar nada do React nem do DOM. Os valores aqui são a única fonte dos preços.
 */

export type PlanId = 'solo' | 'studio' | 'salao'
export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'canceled'
export type BillingMethod = 'card' | 'pix'

export interface PlanInfo {
  id: PlanId
  name: string
  /** preço mensal em centavos de real */
  cents: number
  audience: string
  features: string[]
}

/** todo negócio novo começa com este teste grátis, sem cartão, no plano que escolheu no cadastro */
export const TRIAL_DAYS = 30

export const PLANS: Record<PlanId, PlanInfo> = {
  solo: {
    id: 'solo',
    name: 'Solo',
    cents: 990,
    audience: 'Para quem atende sozinha',
    features: ['Agenda e clientes', 'Financeiro básico', 'Site do negócio'],
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    cents: 2990,
    audience: 'Equipe pequena',
    features: ['Tudo do Solo', 'Comissões por profissional', 'Fechamento mensal em recibo', 'Relatórios'],
  },
  salao: {
    id: 'salao',
    name: 'Salão',
    cents: 5990,
    audience: 'Equipe maior',
    features: ['Tudo do Studio', 'Mais profissionais e permissões', 'Atendimento prioritário'],
  },
}

export const PLAN_IDS = Object.keys(PLANS) as PlanId[]

/** plano sugerido no cadastro conforme o tamanho da equipe */
export const recommendedPlan = (team: 'solo' | 'small' | 'large' | null): PlanId =>
  team === 'large' ? 'salao' : team === 'small' ? 'studio' : 'solo'
export const isPlanId = (v: unknown): v is PlanId => typeof v === 'string' && v in PLANS

/** quantos meses a pessoa pode pagar adiantado no Pix (o Pix não renova sozinho nas contas Stripe do Brasil) */
export const PIX_MONTHS = [1, 3, 12] as const
export type PixMonths = (typeof PIX_MONTHS)[number]
export const isPixMonths = (v: unknown): v is PixMonths => PIX_MONTHS.includes(v as PixMonths)

/** dias de tolerância depois do fim do período do cartão, para o webhook de renovação chegar */
export const GRACE_DAYS = 2

/** o Stripe exige que o fim do teste esteja a pelo menos 48 h no futuro */
export const MIN_TRIAL_END_HOURS = 49

/** chave que identifica o preço mensal de cada plano no Stripe (criado por scripts/stripe-setup.mjs) */
export const priceLookupKey = (plan: PlanId) => `ikizy_${plan}_monthly`

/** desconto (em %) de quem paga mais meses adiantado no Pix */
export const PIX_DISCOUNT_PCT: Record<PixMonths, number> = { 1: 0, 3: 0, 12: 5 }

/** valor cheio do período, sem desconto */
export const pixFullCents = (plan: PlanId, months: PixMonths) => PLANS[plan].cents * months

/** valor cobrado no Pix para o período, já com o desconto (é o que o servidor manda ao Stripe) */
export const pixAmountCents = (plan: PlanId, months: PixMonths) =>
  Math.round((pixFullCents(plan, months) * (100 - PIX_DISCOUNT_PCT[months])) / 100)

export const monthsLabel = (months: number) => (months === 1 ? '1 mês' : `${months} meses`)

// ---------------------------------------------------------------- estado de acesso

export interface SubscriptionInfo {
  plan: PlanId
  status: BillingStatus
  trialEndsAt: Date | null
  accessUntil: Date
  method: BillingMethod | null
  cancelAtPeriodEnd: boolean
  hasCustomer: boolean
}

/**
 * trial     teste grátis em andamento
 * active    pagando e com acesso
 * ending    acesso acaba em breve sem renovação automática (Pix ou cancelamento agendado)
 * past_due  a cobrança do cartão falhou; ainda dentro da tolerância
 * expired   sem acesso: o sistema abre só para leitura
 * unknown   a assinatura não pôde ser lida (cobrança ainda não ativada neste banco): não avisa nem oferece pagamento
 */
export type AccessState = 'trial' | 'active' | 'ending' | 'past_due' | 'expired' | 'unknown'

const DAY = 24 * 60 * 60 * 1000

export function daysLeft(until: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((until.getTime() - now.getTime()) / DAY))
}

/** avisamos quando faltam até 7 dias */
export const WARN_DAYS = 7

/** assinou no cartão durante o teste grátis: já é assinante, a primeira cobrança só vem no fim do teste */
export const isCardTrial = (sub: SubscriptionInfo) => sub.status === 'trialing' && sub.method === 'card'

export function accessState(sub: SubscriptionInfo, now = new Date()): AccessState {
  if (sub.accessUntil.getTime() <= now.getTime()) return 'expired'
  if (isCardTrial(sub)) return 'active'
  if (sub.status === 'trialing') return 'trial'
  if (sub.status === 'past_due') return 'past_due'
  if (sub.status === 'canceled') return 'ending'
  const renewsByItself = sub.method === 'card' && !sub.cancelAtPeriodEnd
  if (!renewsByItself && daysLeft(sub.accessUntil, now) <= WARN_DAYS) return 'ending'
  return 'active'
}

/** o que mostrar como "renova em" / "acesso até": para cartão, o fim do período sem a tolerância */
export function periodEnd(sub: SubscriptionInfo): Date {
  if (sub.method === 'card') return new Date(sub.accessUntil.getTime() - GRACE_DAYS * DAY)
  return sub.accessUntil
}

/** linha do banco (Data API) -> objeto de trabalho */
export function parseSubscription(row: Record<string, unknown>): SubscriptionInfo | null {
  if (!row || !isPlanId(row.plan) || typeof row.access_until !== 'string') return null
  return {
    plan: row.plan,
    status: row.status as BillingStatus,
    trialEndsAt: typeof row.trial_ends_at === 'string' ? new Date(row.trial_ends_at) : null,
    accessUntil: new Date(row.access_until),
    method: row.billing_method === 'card' || row.billing_method === 'pix' ? row.billing_method : null,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    hasCustomer: typeof row.stripe_customer_id === 'string' && row.stripe_customer_id.length > 0,
  }
}

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

/** uma linha para mostrar na conta: 'Solo · teste grátis, restam 21 dias' */
export function describeSubscription(sub: SubscriptionInfo, now = new Date()): string {
  const name = PLANS[sub.plan].name
  if (isCardTrial(sub) && sub.accessUntil.getTime() > now.getTime()) return name + ' · assinatura ativa, 1ª cobrança em ' + shortDate.format(periodEnd(sub))
  switch (accessState(sub, now)) {
    case 'trial': {
      const d = daysLeft(sub.accessUntil, now)
      return name + ' · teste grátis, ' + (d === 1 ? 'resta 1 dia' : 'restam ' + d + ' dias')
    }
    case 'active':
      return name + ' · ' + (sub.method === 'pix' ? 'Pix, acesso até ' : 'renova em ') + shortDate.format(periodEnd(sub))
    case 'ending':
      return name + ' · acesso até ' + shortDate.format(periodEnd(sub))
    case 'past_due':
      return name + ' · pagamento pendente'
    case 'expired':
      return name + ' · acesso encerrado'
    default:
      return name
  }
}

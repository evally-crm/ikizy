/**
 * Preços exibidos na landing. A cobrança real vem de apps/app/src/lib/plans.ts; o teste
 * apps/app/api/_lib/billing.test.ts confere que os dois arquivos estão com os mesmos valores.
 */
export type PixMonths = 1 | 3 | 12

export const PIX_MONTHS: PixMonths[] = [1, 3, 12]

/** desconto (em %) de quem paga mais meses adiantado no Pix */
export const PIX_DISCOUNT_PCT: Record<PixMonths, number> = { 1: 0, 3: 0, 12: 5 }

export interface LandingPlan {
  id: 'solo' | 'studio' | 'salao'
  name: string
  /** preço mensal em centavos de real */
  cents: number
  hot: boolean
  cta: string
  items: string[]
}

export const PLANS: LandingPlan[] = [
  {
    id: 'solo',
    name: 'Solo',
    cents: 990,
    hot: false,
    cta: 'Começar com 1 mês grátis',
    items: ['1 mês grátis, sem cartão', 'Para quem atende sozinha', '1 profissional (você)', 'Agenda e clientes', 'Financeiro básico', 'Site do negócio'],
  },
  {
    id: 'studio',
    name: 'Studio',
    cents: 2990,
    hot: true,
    cta: 'Testar 1 mês grátis',
    items: ['1 mês grátis, sem cartão', 'Equipe pequena', 'Até 4 profissionais', 'Tudo do Solo', 'Comissões por profissional', 'Fechamento mensal em recibo'],
  },
  {
    id: 'salao',
    name: 'Salão',
    cents: 5990,
    hot: false,
    cta: 'Testar 1 mês grátis',
    items: ['1 mês grátis, sem cartão', 'Equipe maior', 'Profissionais sem limite', 'Tudo do Studio', 'Atendimento prioritário'],
  },
]

/** total do Pix para o período, já com desconto, em centavos */
export const pixTotalCents = (cents: number, months: PixMonths) =>
  Math.round((cents * months * (100 - PIX_DISCOUNT_PCT[months])) / 100)

export const brl = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

/** só o número, no formato 1.234,56 (o "R$" é desenhado à parte, menor) */
export const brlNumber = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)

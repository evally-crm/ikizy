/**
 * Preços exibidos na landing. A cobrança real vem de apps/app/src/lib/plans.ts; o teste
 * apps/app/api/_lib/billing.test.ts confere que os dois arquivos estão com os mesmos valores.
 */
export type PixMonths = 1 | 3

export const PIX_MONTHS: PixMonths[] = [1, 3]

/** desconto (em %) de quem paga mais meses adiantado no Pix (igual ao de apps/app/src/lib/plans.ts) */
export const PIX_DISCOUNT_PCT: Record<PixMonths, number> = { 1: 0, 3: 15 }

export interface LandingPlan {
  id: 'solo' | 'studio' | 'salao'
  name: string
  /** preço mensal em centavos de real */
  cents: number
  hot: boolean
  cta: string
  /** linha curta embaixo do nome, na lista de escolha da landing */
  line: string
  items: string[]
}

export const PLANS: LandingPlan[] = [
  {
    id: 'solo',
    name: 'Solo',
    cents: 990,
    hot: false,
    cta: 'Começar com o Solo',
    line: 'Para quem atende sozinha',
    items: ['Para quem atende sozinha', 'Agenda e clientes', 'Caixa e fechamento do mês', 'Site com agendamento online'],
  },
  {
    id: 'studio',
    name: 'Studio',
    cents: 2990,
    hot: true,
    cta: 'Começar com o Studio',
    line: 'Equipe pequena, com comissões',
    items: ['Equipe pequena', 'Tudo do Solo', 'Até 3 profissionais, cada uma com seu login', 'Comissões por profissional'],
  },
  {
    id: 'salao',
    name: 'Salão',
    cents: 5990,
    hot: false,
    cta: 'Começar com o Salão',
    line: 'Equipe maior, sem limite',
    items: ['Equipe maior', 'Tudo do Studio', 'Profissionais e acessos sem limite', 'Perfis de gerente e recepção'],
  },
]

/** total do Pix para o período, já com desconto, em centavos */
export const pixTotalCents = (cents: number, months: PixMonths) =>
  Math.round((cents * months * (100 - PIX_DISCOUNT_PCT[months])) / 100)

/** teste grátis de todo negócio novo, em qualquer plano (igual a TRIAL_DAYS do app) */
export const TRIAL_DAYS = 30

export const brl = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

/** só o número, no formato 1.234,56 (o "R$" é desenhado à parte, menor) */
export const brlNumber = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)

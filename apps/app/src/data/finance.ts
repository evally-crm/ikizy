import { addMinutes, addMonths, endOfMonth, format, getDate, getDay, getDaysInMonth, setDate, setHours, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface CategoryLine {
  name: string
  qty: number
  total: number
}

export interface CommissionLine {
  professionalId: string
  qty: number
  total: number
}

export interface PaymentLine {
  method: string
  total: number
}

export interface MonthClosing {
  /** yyyy-MM */
  id: string
  date: Date
  label: string
  isCurrent: boolean
  closedAt: Date | null
  daysInMonth: number
  elapsedDays: number
  categories: CategoryLine[]
  gross: number
  cardFees: number
  products: number
  /** saídas lançadas no mês (aluguel, contas...) */
  expenses: number
  commissions: CommissionLine[]
  commissionsTotal: number
  net: number
  payments: PaymentLine[]
  appointments: number
  ticket: number
  newClients: number
  returnRate: number
  noShows: number
  /** faturamento por dia; null = dia que ainda não chegou */
  daily: (number | null)[]
}

export const MONTHLY_GOAL = 30000

const CATEGORIES = [
  { name: 'Unhas', qty: 96, avg: 118 },
  { name: 'Cílios', qty: 48, avg: 176 },
  { name: 'Cabelo', qty: 52, avg: 198 },
  { name: 'Sobrancelha', qty: 38, avg: 68 },
  { name: 'Estética facial', qty: 14, avg: 160 },
]

const COMMISSION_SHARE = [
  { professionalId: 'ana', share: 0.38 },
  { professionalId: 'bia', share: 0.33 },
  { professionalId: 'carla', share: 0.29 },
]

const PAYMENT_SHARE = [
  { method: 'Pix', share: 0.48 },
  { method: 'Crédito', share: 0.32 },
  { method: 'Débito', share: 0.14 },
  { method: 'Dinheiro', share: 0.06 },
]

/** peso por dia da semana (0 = domingo, fechado) */
const WEEKDAY_WEIGHT = [0, 0.8, 0.85, 0.95, 1.1, 1.35, 1.6]

/** gerador pseudoaleatório determinístico, para o mock não mudar a cada render */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildMonth(date: Date, opts: { factor: number; seed: number; current: boolean; today: Date }): MonthClosing {
  const rand = seeded(opts.seed)
  const daysInMonth = getDaysInMonth(date)
  const elapsedDays = opts.current ? getDate(opts.today) : daysInMonth
  const ratio = elapsedDays / daysInMonth

  const categories = CATEGORIES.map((c) => {
    const qty = Math.round(c.qty * opts.factor * ratio * (0.9 + rand() * 0.2))
    return { name: c.name, qty, total: qty * c.avg }
  })
  const gross = categories.reduce((s, c) => s + c.total, 0)
  const appointments = categories.reduce((s, c) => s + c.qty, 0)
  const cardFees = Math.round(gross * 0.031)
  const products = Math.round(gross * 0.075)
  const commissions = COMMISSION_SHARE.map(({ professionalId, share }) => ({
    professionalId,
    qty: Math.round(appointments * share),
    total: Math.round(gross * 0.3 * share),
  }))
  const commissionsTotal = commissions.reduce((s, c) => s + c.total, 0)
  const payments = PAYMENT_SHARE.map(({ method, share }) => ({ method, total: Math.round(gross * share) }))

  const weights = Array.from({ length: daysInMonth }, (_, i) => {
    if (i + 1 > elapsedDays) return null
    return WEEKDAY_WEIGHT[getDay(setDate(date, i + 1))] * (0.75 + rand() * 0.5)
  })
  const weightSum = weights.reduce<number>((s, w) => s + (w ?? 0), 0)
  const daily = weights.map((w) => (w === null ? null : weightSum ? Math.round((w / weightSum) * gross) : 0))

  return {
    id: format(date, 'yyyy-MM'),
    date,
    label: format(date, 'MMMM', { locale: ptBR }),
    isCurrent: opts.current,
    closedAt: opts.current ? null : addMinutes(setHours(endOfMonth(date), 19), 42),
    daysInMonth,
    elapsedDays,
    categories,
    gross,
    cardFees,
    products,
    expenses: 0,
    commissions,
    commissionsTotal,
    net: gross - cardFees - products - commissionsTotal,
    payments,
    appointments,
    ticket: appointments ? Math.round(gross / appointments) : 0,
    newClients: Math.round(16 * opts.factor * ratio),
    returnRate: 66 + Math.round(rand() * 10),
    noShows: Math.round(7 * ratio * (0.6 + rand() * 0.6)),
    daily,
  }
}

/** dois meses já fechados + o mês atual em aberto */
export function getMonths(today = new Date()): MonthClosing[] {
  return [-2, -1, 0].map((offset, i) =>
    buildMonth(startOfMonth(addMonths(today, offset)), {
      factor: [0.92, 1, 1.06][i],
      seed: 7 + i * 13,
      current: offset === 0,
      today,
    }),
  )
}

/** ocupação média por horário (linhas, 9h–18h) x dia da semana (colunas, seg–sáb), de 0 a 3 */
export const occupancyHeat: number[][] = [
  [0, 0, 1, 1, 2, 3],
  [0, 1, 1, 1, 2, 3],
  [1, 1, 2, 2, 3, 3],
  [1, 1, 1, 2, 2, 3],
  [0, 0, 1, 1, 1, 2],
  [0, 1, 1, 2, 2, 3],
  [1, 1, 2, 2, 3, 3],
  [1, 2, 2, 3, 3, 3],
  [2, 2, 2, 3, 3, 2],
  [1, 1, 1, 2, 3, 1],
]

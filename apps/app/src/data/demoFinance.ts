import { addMinutes, addMonths, endOfMonth, format, getDate, getDay, getDaysInMonth, setDate, setHours, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { MonthClosing } from '../domain/finance'

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

function buildDemoMonth(date: Date, opts: { factor: number; seed: number; current: boolean; today: Date }): MonthClosing {
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

/** dados de exemplo da demonstração (sem banco): dois meses já fechados + o mês atual em aberto */
export function getDemoMonths(today = new Date()): MonthClosing[] {
  return [-2, -1, 0].map((offset, i) =>
    buildDemoMonth(startOfMonth(addMonths(today, offset)), {
      factor: [0.92, 1, 1.06][i],
      seed: 7 + i * 13,
      current: offset === 0,
      today,
    }),
  )
}

/** período de exemplo (sem banco): cada mês entra na proporção dos dias escolhidos, sem produtos */
export function demoPeriod(months: MonthClosing[], from: Date, to: Date): MonthClosing {
  const day = 24 * 60 * 60 * 1000
  const span = Math.round((to.getTime() - from.getTime()) / day) + 1
  const daily: (number | null)[] = Array.from({ length: span }, () => 0)
  let gross = 0
  let fees = 0
  let count = 0
  let noShows = 0
  let newClients = 0
  let returning = 0
  const categories = new Map<string, { qty: number; total: number }>()
  const payments = new Map<string, number>()
  const commissions = new Map<string, { qty: number; total: number }>()

  for (const m of months) {
    const inRange = m.daily.map((v, i) => ({ v, at: new Date(m.date.getFullYear(), m.date.getMonth(), i + 1) })).filter((d) => d.at >= from && d.at <= to)
    const part = inRange.reduce((s, d) => s + (d.v ?? 0), 0)
    if (!part || !m.gross) continue
    const r = part / m.gross
    for (const d of inRange) daily[Math.round((d.at.getTime() - from.getTime()) / day)] = d.v
    gross += part
    fees += Math.round(m.cardFees * r)
    count += Math.round(m.appointments * r)
    noShows += Math.round(m.noShows * r)
    newClients += Math.round(m.newClients * r)
    returning += m.returnRate * r
    for (const c of m.categories) categories.set(c.name, { qty: (categories.get(c.name)?.qty ?? 0) + Math.round(c.qty * r), total: (categories.get(c.name)?.total ?? 0) + Math.round(c.total * r) })
    for (const p of m.payments) payments.set(p.method, (payments.get(p.method) ?? 0) + Math.round(p.total * r))
    for (const c of m.commissions) commissions.set(c.professionalId, { qty: (commissions.get(c.professionalId)?.qty ?? 0) + Math.round(c.qty * r), total: (commissions.get(c.professionalId)?.total ?? 0) + Math.round(c.total * r) })
  }

  const commissionList = [...commissions.entries()].map(([professionalId, c]) => ({ professionalId, ...c }))
  const commissionsTotal = commissionList.reduce((s, c) => s + c.total, 0)
  const label = `${format(from, "d 'de' MMM", { locale: ptBR })} a ${format(to, "d 'de' MMM yyyy", { locale: ptBR })}`
  return {
    id: `${format(from, 'yyyyMMdd')}-${format(to, 'yyyyMMdd')}`,
    date: from,
    label,
    isCurrent: false,
    closedAt: null,
    daysInMonth: span,
    elapsedDays: span,
    categories: [...categories.entries()].map(([name, c]) => ({ name, ...c })).sort((a, b) => b.total - a.total),
    gross,
    cardFees: fees,
    products: 0,
    expenses: 0,
    commissions: commissionList,
    commissionsTotal,
    net: gross - fees - commissionsTotal,
    payments: [...payments.entries()].map(([method, total]) => ({ method, total })),
    appointments: count,
    ticket: count ? Math.round(gross / count) : 0,
    newClients,
    returnRate: gross ? Math.round(returning / Math.max(1, months.filter((m) => m.gross).length)) : 0,
    noShows,
    daily,
    partial: true,
    rangeLabel: label,
  }
}

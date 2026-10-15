import { addDays, addMonths, differenceInCalendarDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cardFeeOf, cents, methodLabel } from './rates'
import type { CategoryLine, CommissionLine, Expense, MethodKey, MonthClosing, PaymentLine, ProfessionalRate, SettledAppointment } from './types'

export interface MonthInput {
  /** primeiro dia do mês */
  date: Date
  today: Date
  /** o mês ainda está em andamento */
  current: boolean
  appointments: SettledAppointment[]
  professionals: ProfessionalRate[]
  /** quando cada cliente foi cadastrada (para novas clientes e retorno) */
  clientsCreated: Record<string, Date>
  /** gasto mensal com produtos (cadastrado em Meu site) */
  productsSpend: number
  expenses: Expense[]
}

export interface PeriodInput {
  /** primeiro dia do período (meia-noite) */
  from: Date
  /** último dia do período, inclusive */
  to: Date
  today: Date
  appointments: SettledAppointment[]
  professionals: ProfessionalRate[]
  clientsCreated: Record<string, Date>
  expenses: Expense[]
}

/** soma por chave, em ordem decrescente de total */
function groupTotals<K extends string>(items: SettledAppointment[], keyOf: (a: SettledAppointment) => K) {
  const map = new Map<K, { qty: number; total: number }>()
  for (const a of items) {
    const key = keyOf(a)
    const row = map.get(key) ?? { qty: 0, total: 0 }
    row.qty += 1
    row.total += a.price
    map.set(key, row)
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.total - a.total)
}

/** o mês em números, calculado dos atendimentos encerrados (concluídos e faltas) */
export function buildMonth(input: MonthInput): MonthClosing {
  const { date, current, productsSpend } = input
  const last = addDays(addMonths(date, 1), -1)
  return summarize({ ...input, from: date, to: last }, { id: format(date, 'yyyy-MM'), label: format(date, 'MMMM', { locale: ptBR }), current, productsSpend })
}

/** um período qualquer (de um dia a vários meses): os mesmos números do mês, sem os produtos (que são um gasto mensal) */
export function buildPeriod(input: PeriodInput): MonthClosing {
  const { from, to } = input
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()
  const fmt = (d: Date, p: string) => format(d, p, { locale: ptBR })
  const rangeLabel =
    differenceInCalendarDays(to, from) === 0
      ? fmt(from, "d 'de' MMMM yyyy")
      : sameMonth
        ? `${fmt(from, 'd')} a ${fmt(to, "d 'de' MMMM yyyy")}`
        : `${fmt(from, "d 'de' MMM")} a ${fmt(to, "d 'de' MMM yyyy")}`
  const today = input.today
  const current = today >= from && today <= addDays(to, 1)
  return {
    ...summarize(input, { id: `${format(from, 'yyyyMMdd')}-${format(to, 'yyyyMMdd')}`, label: rangeLabel, current, productsSpend: 0 }),
    partial: true,
    rangeLabel,
  }
}

interface SummaryMeta {
  id: string
  label: string
  current: boolean
  productsSpend: number
}

function summarize(input: PeriodInput, meta: SummaryMeta): MonthClosing {
  const { today, appointments, professionals, clientsCreated, expenses: expenseList } = input
  const { productsSpend, current } = meta
  const date = input.from
  const from = date.getTime()
  const to = addDays(input.to, 1).getTime()
  const inMonth = appointments.filter((a) => a.startsAt.getTime() >= from && a.startsAt.getTime() < to)
  const done = inMonth.filter((a) => a.status === 'concluido')
  const gross = done.reduce((s, a) => s + a.price, 0)

  const categories: CategoryLine[] = groupTotals(done, (a) => a.category || 'Outros').map(({ key, qty, total }) => ({ name: key, qty, total }))

  const soldBy = new Map(groupTotals(done, (a) => a.professionalId).map((r) => [r.key, r]))
  // só entra comissão de quem tem percentual definido; sem equipe (ou sem %), não há o que descontar
  const commissions: CommissionLine[] = professionals
    .filter((p) => p.commissionPct > 0)
    .map((p) => {
      const sold = soldBy.get(p.id) ?? { qty: 0, total: 0 }
      return { professionalId: p.id, qty: sold.qty, total: cents(sold.total * (p.commissionPct / 100)) }
    })
    .filter((c) => c.qty > 0)
  const commissionsTotal = commissions.reduce((s, c) => s + c.total, 0)

  const payments: PaymentLine[] = groupTotals(done, (a): MethodKey => a.paymentMethod ?? 'nao').map(({ key, total }) => ({
    method: methodLabel(key),
    total,
  }))
  const cardTotal = done.filter((a) => a.paymentMethod === 'credito' || a.paymentMethod === 'debito').reduce((s, a) => s + a.price, 0)
  const cardFees = cardFeeOf(cardTotal)

  const fromKey = format(date, 'yyyy-MM-dd')
  const toKey = format(input.to, 'yyyy-MM-dd')
  const expenses = expenseList.filter((e) => e.date >= fromKey && e.date <= toKey).reduce((s, e) => s + e.amount, 0)

  const daysInMonth = differenceInCalendarDays(input.to, date) + 1
  const elapsedDays = Math.min(Math.max(differenceInCalendarDays(today, date) + 1, 0), daysInMonth)
  const daily: (number | null)[] = Array.from({ length: daysInMonth }, (_, i) => (i + 1 > elapsedDays ? null : 0))
  for (const a of done) {
    const day = differenceInCalendarDays(a.startsAt, date)
    daily[day] = (daily[day] ?? 0) + a.price
  }

  const servedIds = new Set(done.map((a) => a.clientId))
  const returning = [...servedIds].filter((id) => (clientsCreated[id]?.getTime() ?? Infinity) < from).length
  const newClients = Object.values(clientsCreated).filter((c) => c.getTime() >= from && c.getTime() < to).length

  return {
    id: meta.id,
    date,
    label: meta.label,
    isCurrent: current,
    closedAt: null,
    daysInMonth,
    elapsedDays,
    categories,
    gross,
    cardFees,
    products: productsSpend,
    expenses,
    commissions,
    commissionsTotal,
    net: cents(gross - cardFees - productsSpend - expenses - commissionsTotal),
    payments,
    appointments: done.length,
    ticket: done.length ? Math.round(gross / done.length) : 0,
    newClients,
    returnRate: servedIds.size ? Math.round((returning / servedIds.size) * 100) : 0,
    noShows: inMonth.filter((a) => a.status === 'faltou').length,
    daily,
  }
}

import { addMonths, format, getDate, getDaysInMonth } from 'date-fns'
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
  const { date, today, current, appointments, professionals, clientsCreated, productsSpend, expenses: expenseList } = input
  const from = date.getTime()
  const to = addMonths(date, 1).getTime()
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

  const monthKey = format(date, 'yyyy-MM')
  const expenses = expenseList.filter((e) => e.date.startsWith(monthKey)).reduce((s, e) => s + e.amount, 0)

  const daysInMonth = getDaysInMonth(date)
  const elapsedDays = current ? getDate(today) : daysInMonth
  const daily: (number | null)[] = Array.from({ length: daysInMonth }, (_, i) => (i + 1 > elapsedDays ? null : 0))
  for (const a of done) {
    const day = a.startsAt.getDate() - 1
    daily[day] = (daily[day] ?? 0) + a.price
  }

  const servedIds = new Set(done.map((a) => a.clientId))
  const returning = [...servedIds].filter((id) => (clientsCreated[id]?.getTime() ?? Infinity) < from).length
  const newClients = Object.values(clientsCreated).filter((c) => c.getTime() >= from && c.getTime() < to).length

  return {
    id: monthKey,
    date,
    label: format(date, 'MMMM', { locale: ptBR }),
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

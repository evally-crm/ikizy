import { format } from 'date-fns'
import { METHOD_ORDER, cardFeeOf, cents, methodLabel } from './rates'
import type { DayStatement, Expense, MethodKey, ProfessionalRate, SettledAppointment } from './types'

export interface DayInput {
  /** yyyy-MM-dd */
  date: string
  appointments: SettledAppointment[]
  professionals: ProfessionalRate[]
  expenses: Expense[]
}

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes()

/** o dia em números: base do recibo do dia (os produtos entram só no fechamento do mês) */
export function buildDayStatement({ date, appointments, professionals, expenses }: DayInput): DayStatement {
  const ofDay = appointments.filter((a) => format(a.startsAt, 'yyyy-MM-dd') === date)
  const done = ofDay.filter((a) => a.status === 'concluido').sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const methodOf = (a: SettledAppointment): MethodKey => a.paymentMethod ?? 'nao'
  const sum = (list: SettledAppointment[]) => list.reduce((total, a) => total + a.price, 0)

  const gross = sum(done)
  const cardFees = cardFeeOf(sum(done.filter((a) => a.paymentMethod === 'credito' || a.paymentMethod === 'debito')))

  const commissions = professionals
    .filter((p) => p.commissionPct > 0)
    .map((p) => {
      const mine = done.filter((a) => a.professionalId === p.id)
      return { professionalId: p.id, qty: mine.length, total: cents(sum(mine) * (p.commissionPct / 100)) }
    })
    .filter((c) => c.qty > 0)
  const commissionsTotal = commissions.reduce((total, c) => total + c.total, 0)

  const dayExpenses = expenses.filter((e) => e.date === date)
  const expensesTotal = dayExpenses.reduce((total, e) => total + e.amount, 0)

  return {
    date,
    items: done.map((a) => ({
      id: a.id,
      time: minutesOf(a.startsAt),
      clientName: a.clientName,
      serviceName: a.serviceName,
      professionalId: a.professionalId,
      method: methodOf(a),
      price: a.price,
    })),
    gross,
    count: done.length,
    noShows: ofDay.filter((a) => a.status === 'faltou').length,
    byMethod: METHOD_ORDER.map((method) => ({ method, label: methodLabel(method), total: sum(done.filter((a) => methodOf(a) === method)) })).filter(
      (m) => m.total > 0,
    ),
    cardFees,
    commissions,
    commissionsTotal,
    expenses: dayExpenses,
    expensesTotal,
    net: cents(gross - cardFees - commissionsTotal - expensesTotal),
  }
}

import { METHOD_ORDER, methodLabel } from './rates'
import type { CashAppointment, DayCash, Expense, MethodKey } from './types'

/** atendimentos que ainda vão virar dinheiro hoje */
const PENDING_STATUSES = ['pendente', 'confirmado', 'atendimento']

/**
 * caixa de um dia: o que já entrou (por forma de pagamento), o que falta receber e as saídas.
 * `day` é yyyy-MM-dd.
 */
export function buildDayCash<T extends CashAppointment>(day: string, appointments: T[], expenses: Expense[]): DayCash<T> {
  const ofDay = appointments.filter((a) => a.date === day).sort((a, b) => a.start - b.start)
  const received = ofDay.filter((a) => a.status === 'concluido')
  const toReceive = ofDay.filter((a) => PENDING_STATUSES.includes(a.status))
  const sum = (list: T[]) => list.reduce((total, a) => total + a.price, 0)
  const methodOf = (a: T): MethodKey => a.paymentMethod ?? 'nao'

  const dayExpenses = expenses.filter((e) => e.date === day)
  return {
    received,
    toReceive,
    total: sum(received),
    expected: sum(toReceive),
    byMethod: METHOD_ORDER.map((method) => ({ method, label: methodLabel(method), total: sum(received.filter((a) => methodOf(a) === method)) })).filter(
      (m) => m.total > 0,
    ),
    expenses: dayExpenses,
    expensesTotal: dayExpenses.reduce((total, e) => total + e.amount, 0),
  }
}

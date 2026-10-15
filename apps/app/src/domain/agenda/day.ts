import type { AppointmentStatus } from '../../types'

/** como o status aparece em frases curtas ("Ana: confirmado") */
export const STATUS_NAME: Record<AppointmentStatus, string> = {
  pendente: 'aguardando',
  confirmado: 'confirmado',
  atendimento: 'em atendimento',
  concluido: 'concluído',
  cancelado: 'cancelado',
  faltou: 'falta',
}

export interface DayAppointment {
  id: string
  /** yyyy-MM-dd */
  date: string
  start: number
  price: number
  status: AppointmentStatus
}

/** atendimentos que contam na agenda: tudo menos os cancelados */
export const isListed = (a: { status: AppointmentStatus }) => a.status !== 'cancelado'

/** os atendimentos de um dia (yyyy-MM-dd), sem os cancelados */
export function appointmentsOn<T extends DayAppointment>(list: T[], day: string): T[] {
  return list.filter((a) => a.date === day && isListed(a))
}

/** quantos atendimentos há em cada dia (para os pontinhos do calendário) */
export function countByDay(list: DayAppointment[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const a of list) if (isListed(a)) map.set(a.date, (map.get(a.date) ?? 0) + 1)
  return map
}

export interface DaySummary<T> {
  count: number
  /** soma dos preços dos atendimentos que ainda valem (sem faltas) */
  expected: number
  /** pedidos esperando confirmação */
  awaiting: number
  concluded: number
  /** hoje: o próximo a começar; em outro dia: o primeiro do dia */
  next: T | null
}

/**
 * números do dia: quantos atendimentos, quanto está previsto, quantos pedem confirmação e o próximo.
 * `nowMinutes` só é informado quando o dia é hoje.
 */
export function summarizeDay<T extends DayAppointment>(list: T[], day: string, nowMinutes: number | null): DaySummary<T> {
  const items = appointmentsOn(list, day).sort((a, b) => a.start - b.start)
  const counted = items.filter((a) => a.status !== 'faltou')
  const upcoming = nowMinutes === null ? counted : counted.filter((a) => a.start >= nowMinutes && a.status !== 'concluido')
  return {
    count: items.length,
    expected: counted.reduce((sum, a) => sum + a.price, 0),
    awaiting: items.filter((a) => a.status === 'pendente').length,
    concluded: items.filter((a) => a.status === 'concluido').length,
    next: upcoming[0] ?? null,
  }
}

export type NextStep = 'confirm' | 'start' | 'conclude'

/** o próximo passo natural de um atendimento: confirmar, iniciar ou concluir */
export function nextStep(status: AppointmentStatus): NextStep {
  if (status === 'pendente') return 'confirm'
  if (status === 'confirmado') return 'start'
  return 'conclude'
}

/** o horário do primeiro atendimento (minutos), ou null se a lista está vazia */
export function earliestStart(list: { start: number }[]): number | null {
  return list.length ? Math.min(...list.map((a) => a.start)) : null
}

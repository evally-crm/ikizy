import { addDays, isAfter } from 'date-fns'
import { MISSING_AFTER, clientTags, daysSince, type ClientTag, type TaggableClient } from './tags'

export type SuggestedMessage = 'aniversario' | 'sumida' | 'manutencao' | 'livre'

export interface ProfileClient extends TaggableClient {
  visits: number
  totalSpent: number
  /** intervalo médio entre visitas, em dias */
  interval: number
  anamnesisSignedAt: Date | null
  appointments: { status: string; date: Date; service: string }[]
}

/** como a faixa de retorno do perfil deve falar com a dona */
export type ReturnState =
  | { kind: 'upcoming'; when: Date; service: string; awaiting: boolean }
  | { kind: 'missing'; days: number }
  | { kind: 'late'; days: number }
  | { kind: 'expected'; on: Date; sinceDays: number }
  | { kind: 'none' }

export interface ClientProfile {
  hasVisits: boolean
  tags: ClientTag[]
  /** dias desde a última visita */
  days: number
  nextExpected: Date
  /** dias de atraso do retorno (0 se em dia ou sem visitas) */
  overdue: number
  ticket: number
  suggested: SuggestedMessage
  returnState: ReturnState
  /** ficha de anamnese assinada e com respostas */
  fileDone: boolean
}

/** tudo que o perfil mostra de uma cliente, calculado num lugar só */
export function clientProfile(c: ProfileClient, today: Date, answeredCount: number): ClientProfile {
  const hasVisits = c.visits > 0
  const tags = clientTags(c, today)
  const days = daysSince(c.lastVisit, today)
  const nextExpected = addDays(c.lastVisit, c.interval)
  const overdue = hasVisits ? Math.max(daysSince(nextExpected, today), 0) : 0
  const ticket = hasVisits ? Math.round(c.totalSpent / c.visits) : 0
  const missing = hasVisits && days > MISSING_AFTER

  const suggested: SuggestedMessage = tags.includes('aniversario') ? 'aniversario' : missing ? 'sumida' : overdue > 0 ? 'manutencao' : 'livre'

  const upcoming = c.appointments
    .filter((a) => (a.status === 'pendente' || a.status === 'confirmado') && isAfter(a.date, today))
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0]

  let returnState: ReturnState
  if (upcoming) returnState = { kind: 'upcoming', when: upcoming.date, service: upcoming.service, awaiting: upcoming.status === 'pendente' }
  else if (overdue > 0) returnState = missing ? { kind: 'missing', days } : { kind: 'late', days: overdue }
  else if (hasVisits) returnState = { kind: 'expected', on: nextExpected, sinceDays: days }
  else returnState = { kind: 'none' }

  return {
    hasVisits,
    tags,
    days,
    nextExpected,
    overdue,
    ticket,
    suggested,
    returnState,
    fileDone: Boolean(c.anamnesisSignedAt) && answeredCount > 0,
  }
}

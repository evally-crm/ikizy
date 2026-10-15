import { differenceInCalendarDays, format } from 'date-fns'

export type ClientTag = 'vip' | 'nova' | 'sumida' | 'aniversario'

/** dias sem aparecer para considerar a cliente "sumida" */
export const MISSING_AFTER = 45

/** até quantos dias desde o cadastro a cliente ainda é "nova" */
export const NEW_WITHIN = 30

/** intervalo entre visitas assumido quando há menos de duas visitas, em dias */
export const DEFAULT_INTERVAL = 30

export const TAG_LABEL: Record<ClientTag, string> = {
  vip: 'VIP',
  nova: 'Nova',
  sumida: 'Sumida',
  aniversario: 'Aniversário',
}

/** o que as marcações precisam saber de uma cliente */
export interface TaggableClient {
  since: Date
  lastVisit: Date
  /** MM-dd, vazio quando não informado */
  birthday: string
  vip: boolean
}

/** dias entre duas datas de calendário */
export const daysSince = (date: Date, today: Date) => differenceInCalendarDays(today, date)

/** marcações da cliente: VIP, nova, sumida e aniversariante do mês */
export function clientTags(c: TaggableClient, today: Date): ClientTag[] {
  const tags: ClientTag[] = []
  if (c.vip) tags.push('vip')
  if (daysSince(c.since, today) <= NEW_WITHIN) tags.push('nova')
  if (daysSince(c.lastVisit, today) > MISSING_AFTER) tags.push('sumida')
  if (c.birthday.slice(0, 2) === format(today, 'MM')) tags.push('aniversario')
  return tags
}

const DAY_MS = 24 * 60 * 60 * 1000

/** intervalo médio entre visitas (dias, ao menos 1), das mais recentes para as mais antigas; padrão com menos de duas */
export function averageInterval(doneDates: Date[]): number {
  if (doneDates.length < 2) return DEFAULT_INTERVAL
  const newest = Math.max(...doneDates.map((d) => d.getTime()))
  const oldest = Math.min(...doneDates.map((d) => d.getTime()))
  return Math.max(1, Math.round((newest - oldest) / DAY_MS / (doneDates.length - 1)))
}

/** "Veio hoje", "Veio ontem" ou "Última visita há N dias" */
export function lastVisitLabel(days: number): string {
  if (days === 0) return 'Veio hoje'
  if (days === 1) return 'Veio ontem'
  return `Última visita há ${days} dias`
}

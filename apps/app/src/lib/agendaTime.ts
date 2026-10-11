import { format } from 'date-fns'

/** janela da agenda: das 8h às 20h */
export const START_HOUR = 8
export const END_HOUR = 20
/** intervalo entre os horários oferecidos ao agendar, em minutos */
export const SLOT_STEP = 30

export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

/** "14:30" -> 870 */
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const PERIODS = [
  { id: 'manha', label: 'Manhã', from: START_HOUR * 60, to: 12 * 60 },
  { id: 'tarde', label: 'Tarde', from: 12 * 60, to: 18 * 60 },
  { id: 'noite', label: 'Noite', from: 18 * 60, to: END_HOUR * 60 },
] as const

/** "1h 30min", "45min", "2h" */
export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}min`
  return m ? `${h}h ${m}min` : `${h}h`
}

/** intervalo de atendimento de um dia da semana (0 = domingo), em minutos desde 00:00 */
export interface HourInterval {
  weekday: number
  start: number
  end: number
}

/**
 * o horário cabe no expediente? Sem nenhum intervalo cadastrado a profissional ainda não configurou:
 * vale a grade padrão da agenda (START_HOUR..END_HOUR).
 */
export function withinHours(list: HourInterval[] | undefined, weekday: number, start: number, duration: number) {
  if (!list || list.length === 0) return true
  return list.some((i) => i.weekday === weekday && start >= i.start && start + duration <= i.end)
}

/**
 * janela da grade, em horas cheias: do primeiro início ao último fim do horário de atendimento cadastrado
 * (de qualquer dia, para a grade não mudar de tamanho a cada dia), alargada para caber os atendimentos do dia.
 * Sem nenhum horário cadastrado, vale a grade padrão (START_HOUR..END_HOUR).
 */
export function gridWindow(hours: HourInterval[][], dayStarts: { start: number; duration: number }[]) {
  const all = hours.flat()
  let from = all.length ? Math.min(...all.map((i) => i.start)) : START_HOUR * 60
  let to = all.length ? Math.max(...all.map((i) => i.end)) : END_HOUR * 60
  for (const a of dayStarts) {
    from = Math.min(from, a.start)
    to = Math.max(to, a.start + a.duration)
  }
  const startHour = Math.max(0, Math.floor(from / 60))
  const endHour = Math.min(24, Math.max(startHour + 1, Math.ceil(to / 60)))
  return { startHour, endHour }
}

/** trechos da grade (de `fromHour` a `toHour`) fora do expediente naquele dia; vazio quando não há horário cadastrado */
export function closedRanges(
  list: HourInterval[] | undefined,
  weekday: number,
  fromHour: number = START_HOUR,
  toHour: number = END_HOUR,
): [number, number][] {
  if (!list || list.length === 0) return []
  const from = fromHour * 60
  const to = toHour * 60
  const open = list
    .filter((i) => i.weekday === weekday)
    .sort((a, b) => a.start - b.start)
  const out: [number, number][] = []
  let cursor = from
  for (const i of open) {
    if (i.start > cursor) out.push([cursor, Math.min(i.start, to)])
    cursor = Math.max(cursor, i.end)
  }
  if (cursor < to) out.push([cursor, to])
  return out.filter(([a, b]) => b > a)
}

export const WEEKDAYS = [
  { id: 1, label: 'Segunda' },
  { id: 2, label: 'Terça' },
  { id: 3, label: 'Quarta' },
  { id: 4, label: 'Quinta' },
  { id: 5, label: 'Sexta' },
  { id: 6, label: 'Sábado' },
  { id: 0, label: 'Domingo' },
] as const

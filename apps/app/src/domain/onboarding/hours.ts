import type { HourInterval } from '../../lib/agendaTime'

/** horário que já vem marcado: segunda a sábado, das 9h às 19h */
export const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6]
export const DEFAULT_START = 9 * 60
export const DEFAULT_END = 19 * 60

/** atalhos de horário mais comuns no setor, mostrados embaixo do campo */
export const HOUR_PRESETS: { id: string; label: string; days: number[]; start: number; end: number }[] = [
  { id: 'seg-sab', label: 'Seg a sáb, 9h às 19h', days: [1, 2, 3, 4, 5, 6], start: 9 * 60, end: 19 * 60 },
  { id: 'seg-sex', label: 'Seg a sex, 8h às 18h', days: [1, 2, 3, 4, 5], start: 8 * 60, end: 18 * 60 },
  { id: 'ter-sab', label: 'Ter a sáb, 10h às 20h', days: [2, 3, 4, 5, 6], start: 10 * 60, end: 20 * 60 },
  { id: 'todos', label: 'Todos os dias, 9h às 21h', days: [0, 1, 2, 3, 4, 5, 6], start: 9 * 60, end: 21 * 60 },
]

/** os dias na ordem da semana brasileira (segunda primeiro), com a letra do botão */
export const DAY_CHIPS: { weekday: number; short: string; label: string }[] = [
  { weekday: 1, short: 'S', label: 'Segunda' },
  { weekday: 2, short: 'T', label: 'Terça' },
  { weekday: 3, short: 'Q', label: 'Quarta' },
  { weekday: 4, short: 'Q', label: 'Quinta' },
  { weekday: 5, short: 'S', label: 'Sexta' },
  { weekday: 6, short: 'S', label: 'Sábado' },
  { weekday: 0, short: 'D', label: 'Domingo' },
]

/** horários que dá para escolher: de meia em meia hora, das 6h às 23h */
export function timeOptions(from = 6 * 60, to = 23 * 60, step = 30): number[] {
  const out: number[] = []
  for (let m = from; m <= to; m += step) out.push(m)
  return out
}

/** liga ou desliga um dia, mantendo a ordem da semana */
export function toggleDay(days: number[], weekday: number): number[] {
  const next = days.includes(weekday) ? days.filter((d) => d !== weekday) : [...days, weekday]
  return DAY_CHIPS.map((d) => d.weekday).filter((d) => next.includes(d))
}

/** o atalho que bate com o que está marcado (para acender o chip), ou null */
export function matchingPreset(days: number[], start: number, end: number): string | null {
  const key = [...days].sort().join(',')
  return HOUR_PRESETS.find((p) => [...p.days].sort().join(',') === key && p.start === start && p.end === end)?.id ?? null
}

/** os intervalos de cada dia, no formato da agenda */
export const weekHours = (days: number[], start: number, end: number): HourInterval[] =>
  days.map((weekday) => ({ weekday, start, end }))

/** o mesmo, no formato que o banco grava (set_working_hours / create_salon_setup) */
export const hoursForDb = (days: number[], start: number, end: number) =>
  days.map((weekday) => ({ weekday, start_minute: start, end_minute: end }))

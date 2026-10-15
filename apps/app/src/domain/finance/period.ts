import { addDays, addMonths, endOfMonth, isSameDay, isSameMonth, startOfDay, startOfMonth } from 'date-fns'

/** período do filtro de datas: do primeiro ao último dia, os dois inclusive */
export interface DateRange {
  from: Date
  to: Date
}

export interface PeriodPreset {
  id: string
  label: string
  range: DateRange
}

/** o mês inteiro que contém `date` */
export const monthRange = (date: Date): DateRange => ({ from: startOfMonth(date), to: startOfDay(endOfMonth(date)) })

/** o período é exatamente um mês (do dia 1 ao último dia): só esse pode ser fechado */
export const isWholeMonth = ({ from, to }: DateRange) => isSameDay(from, startOfMonth(from)) && isSameDay(to, startOfDay(endOfMonth(from)))

/** atalhos do filtro, em ordem de uso mais comum */
export function periodPresets(today: Date): PeriodPreset[] {
  const day = startOfDay(today)
  return [
    { id: 'hoje', label: 'Hoje', range: { from: day, to: day } },
    { id: '7d', label: 'Últimos 7 dias', range: { from: addDays(day, -6), to: day } },
    { id: '30d', label: 'Últimos 30 dias', range: { from: addDays(day, -29), to: day } },
    { id: 'mes', label: 'Este mês', range: monthRange(day) },
    { id: 'mes-passado', label: 'Mês passado', range: monthRange(addMonths(day, -1)) },
  ]
}

/** o dia clicado depois de `anchor` (primeiro clique) fecha o período, na ordem certa; sem âncora, abre um novo */
export function pickDay(anchor: Date | null, clicked: Date): { anchor: Date | null; range: DateRange | null } {
  const day = startOfDay(clicked)
  if (!anchor) return { anchor: day, range: null }
  return { anchor: null, range: day < anchor ? { from: day, to: anchor } : { from: anchor, to: day } }
}

/** semanas do mês para o calendário (segunda a domingo); dias de fora do mês vêm como null */
export function calendarWeeks(month: Date): (Date | null)[][] {
  const first = startOfMonth(month)
  const cells: (Date | null)[] = Array.from({ length: (first.getDay() + 6) % 7 }, () => null)
  for (let d = first; isSameMonth(d, first); d = addDays(d, 1)) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}

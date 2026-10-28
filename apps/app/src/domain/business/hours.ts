import type { HourInterval } from '../../lib/agendaTime'
import { WEEKDAYS } from '../../lib/agendaTime'
import { formatTime } from '../../lib/format'

/** "Seg a Sex · 09:00–18:00" e "Sáb · 09:00–13:00": junta os dias seguidos com o mesmo horário */
export function summarizeHours(list: HourInterval[] | undefined): string[] {
  if (!list || list.length === 0) return []
  const byDay = WEEKDAYS.map((d) => ({
    label: d.label.slice(0, 3),
    // vários profissionais com o mesmo horário contam uma vez só
    text: [
      ...new Set(
        list
          .filter((i) => i.weekday === d.id)
          .sort((a, b) => a.start - b.start)
          .map((i) => `${formatTime(i.start)}–${formatTime(i.end)}`),
      ),
    ].join(' e '),
  }))
  const out: string[] = []
  let i = 0
  while (i < byDay.length) {
    let j = i
    while (j + 1 < byDay.length && byDay[j + 1].text === byDay[i].text) j++
    if (byDay[i].text) out.push(`${byDay[i].label}${j > i ? ` a ${byDay[j].label}` : ''} · ${byDay[i].text}`)
    i = j + 1
  }
  return out
}

export interface WeekDayHours {
  weekday: number
  /** "Seg", "Ter"... */
  label: string
  /** blocos de atendimento do dia, em ordem */
  blocks: HourInterval[]
}

/** a semana de segunda a domingo, com os blocos de atendimento de cada dia */
export function weekDays(list: HourInterval[] | undefined): WeekDayHours[] {
  return WEEKDAYS.map((d) => ({
    weekday: d.id,
    label: d.label.slice(0, 3),
    blocks: (list ?? []).filter((i) => i.weekday === d.id).sort((a, b) => a.start - b.start),
  }))
}

/** faixa de horas que a grade da semana mostra: do início mais cedo ao fim mais tarde (em horas inteiras), com 8h–20h como padrão */
export function hoursSpan(lists: (HourInterval[] | undefined)[]): { from: number; to: number } {
  const all = lists.flatMap((l) => l ?? [])
  if (all.length === 0) return { from: 8 * 60, to: 20 * 60 }
  return {
    from: Math.floor(Math.min(...all.map((i) => i.start)) / 60) * 60,
    to: Math.ceil(Math.max(...all.map((i) => i.end)) / 60) * 60,
  }
}

export type OpenStatus = { open: true; until: number } | { open: false; opensAt: number | null }

/** se o negócio está aberto agora e até que horas (ou a que horas abre de novo hoje) */
export function openStatus(list: HourInterval[] | undefined, now: Date): OpenStatus {
  const minutes = now.getHours() * 60 + now.getMinutes()
  const today = (list ?? []).filter((i) => i.weekday === now.getDay()).sort((a, b) => a.start - b.start)
  const current = today.find((i) => minutes >= i.start && minutes < i.end)
  if (current) return { open: true, until: current.end }
  const next = today.find((i) => i.start > minutes)
  return { open: false, opensAt: next ? next.start : null }
}

/** onde um bloco de horário cai numa grade vertical da faixa `span`: topo e altura em % */
export function placeBlock(block: HourInterval, span: { from: number; to: number }): { top: number; height: number } {
  const total = Math.max(span.to - span.from, 1)
  const start = Math.max(block.start, span.from)
  const end = Math.min(block.end, span.to)
  return { top: ((start - span.from) / total) * 100, height: (Math.max(end - start, 0) / total) * 100 }
}

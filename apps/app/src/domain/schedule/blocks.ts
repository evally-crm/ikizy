/**
 * Bloqueios de horário (folga, férias, almoço extra) e intervalo entre atendimentos.
 * Regras puras: sem tela e sem banco. O fuso é o de Brasília, o mesmo que as vagas do site usam no banco.
 */

export interface TimeBlock {
  id: string
  /** null = vale para todas as profissionais */
  professionalId: string | null
  startsAt: string
  endsAt: string
  reason: string
}

export interface BlockForm {
  /** '' = todas */
  professionalId: string
  /** AAAA-MM-DD */
  startDate: string
  /** AAAA-MM-DD; no bloqueio de horas é igual à data de início */
  endDate: string
  allDay: boolean
  /** HH:MM, só quando não é o dia inteiro */
  startTime: string
  endTime: string
  reason: string
}

export interface BlockValue {
  professionalId: string | null
  startsAt: string
  endsAt: string
  reason: string
}

export const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60]
export const MAX_BLOCK_DAYS = 366
const DAY_MS = 24 * 60 * 60 * 1000

/** Brasília não tem horário de verão desde 2019: o deslocamento é sempre -03:00 */
const at = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`)

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(at(v, '00:00').getTime())
const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

/** valida o formulário e devolve o período em horário universal, ou a frase do erro */
export function checkBlock(f: BlockForm, now = new Date()): { ok: true; value: BlockValue } | { ok: false; error: string } {
  if (!isDate(f.startDate)) return { ok: false, error: 'Escolha o dia do bloqueio.' }
  const endDate = f.allDay ? f.endDate : f.startDate
  if (!isDate(endDate)) return { ok: false, error: 'Escolha até que dia vai o bloqueio.' }
  if (endDate < f.startDate) return { ok: false, error: 'O último dia não pode ser antes do primeiro.' }

  let start: Date
  let end: Date
  if (f.allDay) {
    start = at(f.startDate, '00:00')
    end = new Date(at(endDate, '00:00').getTime() + DAY_MS)
  } else {
    if (!isTime(f.startTime) || !isTime(f.endTime)) return { ok: false, error: 'Informe o horário de início e de fim.' }
    if (f.endTime <= f.startTime) return { ok: false, error: 'O horário de fim precisa ser depois do início.' }
    start = at(f.startDate, f.startTime)
    end = at(f.startDate, f.endTime)
  }
  if (end.getTime() <= now.getTime()) return { ok: false, error: 'Esse período já passou.' }
  if (end.getTime() - start.getTime() > MAX_BLOCK_DAYS * DAY_MS) return { ok: false, error: 'O bloqueio pode ter no máximo um ano.' }
  return {
    ok: true,
    value: { professionalId: f.professionalId || null, startsAt: start.toISOString(), endsAt: end.toISOString(), reason: f.reason.trim().slice(0, 80) },
  }
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-11-20T13:00:00Z" -> { date: '2026-11-20', minutes: 600, weekday: 5 } em Brasília */
function partsBR(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), weekday: d.getUTCDay() }
}

const dayLabel = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`
const clock = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`

/** "Sex, 20 nov · 10h às 12h" ou "20 nov a 22 nov · dia inteiro" */
export function describeBlock(b: Pick<TimeBlock, 'startsAt' | 'endsAt'>): string {
  const s = partsBR(b.startsAt)
  const e = partsBR(b.endsAt)
  if (s.minutes === 0 && e.minutes === 0) {
    // o fim é a meia-noite do dia seguinte: o último dia inteiro é o anterior
    const last = partsBR(new Date(new Date(b.endsAt).getTime() - 60 * 1000).toISOString()).date
    return last === s.date ? `${DAYS[s.weekday]}, ${dayLabel(s.date)} · dia inteiro` : `${dayLabel(s.date)} a ${dayLabel(last)} · dia inteiro`
  }
  if (s.date === e.date) return `${DAYS[s.weekday]}, ${dayLabel(s.date)} · ${clock(s.minutes)} às ${clock(e.minutes)}`
  return `${dayLabel(s.date)} ${clock(s.minutes)} a ${dayLabel(e.date)} ${clock(e.minutes)}`
}

/** bloqueios que cobrem algum momento do dia (AAAA-MM-DD, em Brasília), da profissional ou de todas */
export function blocksOfDay(blocks: TimeBlock[], date: string, professionalId?: string): TimeBlock[] {
  const start = at(date, '00:00').getTime()
  const end = start + DAY_MS
  return blocks
    .filter((b) => (!professionalId || b.professionalId === null || b.professionalId === professionalId) && new Date(b.startsAt).getTime() < end && new Date(b.endsAt).getTime() > start)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

/** como o bloqueio aparece num dia (AAAA-MM-DD): "dia inteiro" ou "10h às 12h", recortado ao dia */
export function blockOnDayLabel(b: Pick<TimeBlock, 'startsAt' | 'endsAt'>, date: string): string {
  const dayStart = at(date, '00:00').getTime()
  const s = Math.max(new Date(b.startsAt).getTime(), dayStart)
  const e = Math.min(new Date(b.endsAt).getTime(), dayStart + DAY_MS)
  const from = Math.round((s - dayStart) / 60000)
  const to = Math.round((e - dayStart) / 60000)
  return from === 0 && to === 1440 ? 'dia inteiro' : `${clock(from)} às ${clock(to)}`
}

/** só os que ainda não terminaram, do mais próximo ao mais distante */
export function upcomingBlocks(blocks: TimeBlock[], now = new Date()): TimeBlock[] {
  return blocks.filter((b) => new Date(b.endsAt).getTime() > now.getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export const bufferLabel = (min: number) => (min === 0 ? 'Sem intervalo' : `${min} min`)

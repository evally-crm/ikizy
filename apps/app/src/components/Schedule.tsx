import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { findConflict } from '../data/AgendaProvider'
import { END_HOUR, PERIODS, SLOT_STEP, dayKey, withinHours, type HourInterval } from '../lib/agendaTime'
import { formatTime } from '../lib/format'
import type { Appointment } from '../types'

/** semana com setas, no lugar do campo de data do navegador */
export function DateStrip({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const date = parseISO(value)
  const monday = startOfWeek(date, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const today = new Date()
  const month = format(date, 'MMMM yyyy', { locale: ptBR })

  return (
    <div className="dstrip">
      <div className="dstrip__head">
        <button type="button" aria-label="Semana anterior" onClick={() => onChange(dayKey(addDays(date, -7)))}>
          <ChevronLeft size={16} />
        </button>
        <span>{month[0].toUpperCase() + month.slice(1)}</span>
        <button type="button" aria-label="Próxima semana" onClick={() => onChange(dayKey(addDays(date, 7)))}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="dstrip__days" role="group" aria-label="Dia do atendimento">
        {days.map((d) => (
          <button
            key={d.toISOString()}
            type="button"
            className={`dstrip__day ${isSameDay(d, today) ? 'is-today' : ''}`}
            aria-pressed={isSameDay(d, date)}
            aria-label={format(d, "EEEE, d 'de' MMMM", { locale: ptBR })}
            onClick={() => onChange(dayKey(d))}
          >
            <span>{format(d, 'EEEE', { locale: ptBR }).slice(0, 3)}</span>
            <strong>{format(d, 'd')}</strong>
          </button>
        ))}
      </div>
    </div>
  )
}

/** horários do dia em manhã, tarde e noite; os ocupados ficam apagados */
export function SlotPicker({
  date,
  professionalId,
  duration,
  value,
  onChange,
  appointments,
  ignoreId,
  hours,
}: {
  date: string
  professionalId: string
  duration: number
  value: number | null
  onChange: (start: number) => void
  appointments: Appointment[]
  ignoreId?: string
  /** expediente da profissional; sem ele vale a grade padrão */
  hours?: HourInterval[]
}) {
  const now = new Date()
  const isToday = date === dayKey(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const free = (start: number) =>
    start + duration <= END_HOUR * 60 &&
    withinHours(hours, parseISO(date).getDay(), start, duration) &&
    !(isToday && start < nowMinutes) &&
    !findConflict(appointments, { professionalId, date, start, duration }, ignoreId)

  return (
    <div className="slots">
      {PERIODS.map((p) => {
        const starts: number[] = []
        for (let m = p.from; m < p.to; m += SLOT_STEP) starts.push(m)
        // horário fora da grade de 30 min (ex.: clique na agenda às 14:15) continua escolhível
        if (value !== null && value >= p.from && value < p.to && !starts.includes(value)) {
          starts.push(value)
          starts.sort((a, b) => a - b)
        }
        return (
          <div key={p.id} className="slots__period">
            <p className="slots__label">{p.label}</p>
            <div className="slots__grid">
              {starts.map((s) => {
                const ok = free(s)
                return (
                  <button
                    key={s}
                    type="button"
                    className="slot"
                    disabled={!ok}
                    aria-pressed={value === s}
                    onClick={() => onChange(s)}
                  >
                    {formatTime(s)}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

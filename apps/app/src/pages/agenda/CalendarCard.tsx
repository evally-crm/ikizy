import type { CSSProperties } from 'react'
import { addDays, addMonths, endOfMonth, format, getDay, isSameDay, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { dayKey } from '../../lib/agendaTime'
import { Tabs } from '../../components/ui'
import './CalendarCard.css'

export type CalendarView = 'semana' | 'mes'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

/** cartão de calendário: título grande, semana em arco centrada no dia escolhido ou grade do mês */
export function CalendarCard({
  date,
  now,
  view,
  counts,
  summary,
  canCreate,
  side,
  onView,
  onDate,
  onNew,
}: {
  date: Date
  now: Date
  view: CalendarView
  counts: Map<string, number>
  summary: string
  canCreate: boolean
  /** no desktop o cartão vira a coluna lateral: sempre o mês, sem alternador */
  side?: boolean
  onView: (v: CalendarView) => void
  onDate: (d: Date) => void
  onNew: () => void
}) {
  const shown: CalendarView = side ? 'mes' : view
  const monthName = capitalize(format(date, 'MMMM', { locale: ptBR }))
  const step = (d: Date, n: number) => (shown === 'mes' ? addMonths(d, n) : addDays(d, n * 7))

  const arc = Array.from({ length: 7 }, (_, i) => addDays(date, i - 3))
  const first = startOfMonth(date)
  const blanks = (getDay(first) + 6) % 7
  const monthDays = Array.from({ length: endOfMonth(date).getDate() }, (_, i) => addDays(first, i))

  return (
    <section className={`calcard ${side ? 'calcard--flat' : ''}`.trim()} aria-label="Calendário">
      <div className="calcard__top">
        {side ? (
          <h2 className="calcard__month">
            {monthName} <span>{format(date, 'yyyy')}</span>
          </h2>
        ) : (
          <Tabs
            label="Visualização"
            value={view}
            onChange={onView}
            items={[
              { id: 'semana', label: 'Semana' },
              { id: 'mes', label: 'Mês' },
            ]}
          />
        )}
        <div className="calcard__nav">
          <button type="button" aria-label={shown === 'mes' ? 'Mês anterior' : 'Semana anterior'} onClick={() => onDate(step(date, -1))}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="calcard__today" title="Voltar para hoje" onClick={() => onDate(new Date())}>
            Hoje
          </button>
          <button type="button" aria-label={shown === 'mes' ? 'Próximo mês' : 'Próxima semana'} onClick={() => onDate(step(date, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {side ? (
        <h1 className="sr-only">Agenda</h1>
      ) : (
        <h1 className="calcard__title">
          <span>{monthName}</span>
          <span className="calcard__day">{format(date, 'd')}</span>
        </h1>
      )}

      {shown === 'semana' ? (
        <div className="arc" role="tablist" aria-label="Dias da semana">
          {arc.map((d, i) => {
            const dist = Math.abs(i - 3)
            const n = counts.get(dayKey(d)) ?? 0
            return (
              <button
                key={d.toISOString()}
                type="button"
                role="tab"
                aria-selected={i === 3}
                className={`arc__day ${isSameDay(d, now) ? 'is-today' : ''}`.trim()}
                style={{ '--dist': dist } as CSSProperties}
                onClick={() => onDate(d)}
                aria-label={`${format(d, "EEEE, d 'de' MMMM", { locale: ptBR })}${n ? `, ${n} atendimentos` : ''}`}
              >
                <span className="arc__name">{format(d, 'EEEE', { locale: ptBR }).slice(0, 3)}</span>
                <span className="arc__num">{format(d, 'd')}</span>
                <span className={`arc__dot ${n ? 'is-on' : ''}`.trim()} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="monthgrid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="monthgrid__head">
              {w}
            </span>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {monthDays.map((d) => {
            const n = counts.get(dayKey(d)) ?? 0
            return (
              <button
                key={d.toISOString()}
                type="button"
                className={`monthgrid__day ${isSameDay(d, date) ? 'is-selected' : ''} ${isSameDay(d, now) ? 'is-today' : ''}`.trim()}
                onClick={() => {
                  onDate(d)
                  if (!side) onView('semana')
                }}
                aria-label={`${format(d, "d 'de' MMMM", { locale: ptBR })}${n ? `, ${n} atendimentos` : ''}`}
              >
                <span className="monthgrid__num">{format(d, 'd')}</span>
                <span className={`arc__dot ${n ? 'is-on' : ''}`.trim()} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      )}

      {!side && (
        <div className="calcard__foot">
          <span className="calcard__summary">{summary}</span>
          <button type="button" className="calcard__new" disabled={!canCreate} onClick={onNew}>
            <Plus size={15} aria-hidden="true" /> Novo agendamento
          </button>
        </div>
      )}
    </section>
  )
}

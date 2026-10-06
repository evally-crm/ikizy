import { useEffect, useMemo, useState } from 'react'
import { addDays, format, isSameDay, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { appointments, professionals } from '../data/mock'
import { formatBRL, formatTime } from '../lib/format'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Avatar, Button, Em, StatusBadge } from '../components/ui'
import type { Appointment } from '../types'

const START_HOUR = 8
const END_HOUR = 20
const HOUR_H = 72
const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
const toY = (minutes: number) => ((minutes - START_HOUR * 60) / 60) * HOUR_H

function AppointmentDialog({
  appointment,
  onClose,
}: {
  appointment: Appointment
  onClose: () => void
}) {
  const pro = professionals.find((p) => p.id === appointment.professionalId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Atendimento de ${appointment.client}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__head">
          <div>
            <p className="eyebrow">Atendimento</p>
            <h2>{appointment.client}</h2>
          </div>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <dl className="dialog__grid">
          <div>
            <dt>Serviço</dt>
            <dd>{appointment.service}</dd>
          </div>
          <div>
            <dt>Profissional</dt>
            <dd>{pro?.name}</dd>
          </div>
          <div>
            <dt>Horário</dt>
            <dd>
              {formatTime(appointment.start)} – {formatTime(appointment.start + appointment.duration)}
            </dd>
          </div>
          <div>
            <dt>Valor</dt>
            <dd>{formatBRL(appointment.price)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={appointment.status} />
            </dd>
          </div>
        </dl>
        <div className="dialog__actions">
          <Button>Confirmar via WhatsApp</Button>
          <Button variant="ghost">Remarcar</Button>
        </div>
      </div>
    </div>
  )
}

export default function Agenda() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [date, setDate] = useState(() => new Date())
  const [proFilter, setProFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const week = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [date])

  // no mobile mostramos uma profissional por vez
  const activePro = isMobile && proFilter === 'all' ? professionals[0].id : proFilter
  const visiblePros = activePro === 'all' ? professionals : professionals.filter((p) => p.id === activePro)

  const isToday = isSameDay(date, now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const showNow = isToday && nowMinutes >= START_HOUR * 60 && nowMinutes < END_HOUR * 60
  const gridHeight = hours.length * HOUR_H

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <p className="eyebrow">Agenda</p>
          <h1 className="page__title">
            {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
              .split(',')
              .map((part, i) =>
                i === 0 ? <Em key={i}>{part[0].toUpperCase() + part.slice(1)}</Em> : <span key={i}>,{part}</span>,
              )}
          </h1>
        </div>
        <div className="page__actions">
          <Button variant="ghost" size="sm" icon aria-label="Dia anterior" onClick={() => setDate((d) => addDays(d, -1))}>
            <ChevronLeft size={18} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(new Date())}>
            Hoje
          </Button>
          <Button variant="ghost" size="sm" icon aria-label="Próximo dia" onClick={() => setDate((d) => addDays(d, 1))}>
            <ChevronRight size={18} />
          </Button>
          <Button size="sm">
            <Plus size={16} aria-hidden="true" />
            <span className="hide-sm">Novo</span>
          </Button>
        </div>
      </header>

      <div className="weekstrip" role="tablist" aria-label="Dias da semana">
        {week.map((d) => (
          <button
            key={d.toISOString()}
            type="button"
            role="tab"
            aria-selected={isSameDay(d, date)}
            className={`weekstrip__day ${isSameDay(d, now) ? 'is-today' : ''}`}
            onClick={() => setDate(d)}
          >
            <span className="weekstrip__name">{format(d, 'EEEE', { locale: ptBR }).slice(0, 3)}</span>
            <span className="weekstrip__num">{format(d, 'd')}</span>
          </button>
        ))}
      </div>

      <div className="chips" role="group" aria-label="Filtrar por profissional">
        {!isMobile && (
          <button type="button" className="chip" aria-pressed={activePro === 'all'} onClick={() => setProFilter('all')}>
            Todas
          </button>
        )}
        {professionals.map((p) => (
          <button
            key={p.id}
            type="button"
            className="chip"
            aria-pressed={activePro === p.id}
            onClick={() => setProFilter(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="agenda">
        <div className="agenda__head" style={{ gridTemplateColumns: `52px repeat(${visiblePros.length}, minmax(0, 1fr))` }}>
          <span />
          {visiblePros.map((p) => (
            <div key={p.id} className="agenda__pro">
              <Avatar name={p.name} size="sm" />
              <div className="agenda__pro-text">
                <p className="agenda__pro-name">{p.name}</p>
                <p className="agenda__pro-role">{p.role}</p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="agenda__body"
          style={{ height: gridHeight, gridTemplateColumns: `52px repeat(${visiblePros.length}, minmax(0, 1fr))` }}
        >
          <div className="agenda__hours" aria-hidden="true">
            {hours.map((h) => (
              <span key={h} className="agenda__hour" style={{ top: (h - START_HOUR) * HOUR_H }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {visiblePros.map((p) => (
            <div key={p.id} className="agenda__col">
              {hours.map((h) => (
                <div key={h} className="agenda__line" style={{ top: (h - START_HOUR) * HOUR_H }} />
              ))}
              {appointments
                .filter((a) => a.professionalId === p.id)
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`appt appt--${a.status}`}
                    style={{ top: toY(a.start) + 2, height: (a.duration / 60) * HOUR_H - 4 }}
                    onClick={() => setSelected(a)}
                  >
                    <span className="appt__time">
                      {formatTime(a.start)} – {formatTime(a.start + a.duration)}
                    </span>
                    <span className="appt__client">{a.client}</span>
                    <span className="appt__service">{a.service}</span>
                  </button>
                ))}
            </div>
          ))}

          {showNow && (
            <div className="agenda__now" style={{ top: toY(nowMinutes) }} aria-hidden="true">
              <span className="agenda__now-dot" />
            </div>
          )}
        </div>
      </div>

      <ul className="legend" aria-label="Legenda de status">
        <li><span className="legend__dot legend__dot--confirmado" />Confirmado</li>
        <li><span className="legend__dot legend__dot--pendente" />Aguardando</li>
        <li><span className="legend__dot legend__dot--atendimento" />Em atendimento</li>
        <li><span className="legend__dot legend__dot--concluido" />Concluído</li>
      </ul>

      {selected && <AppointmentDialog appointment={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

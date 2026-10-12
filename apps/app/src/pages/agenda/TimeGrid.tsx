import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react'
import { HOUR_HEIGHT, blockHeight, gridHeight, gridHours, minuteAt, proTone, scrollTopFor, yFor } from '../../domain/agenda'
import { closedRanges, type HourInterval } from '../../lib/agendaTime'
import { formatTime } from '../../lib/format'
import { Avatar } from '../../components/ui'
import type { Appointment } from '../../types'
import './TimeGrid.css'

const vars = (v: Record<string, string | number>) => v as CSSProperties

/** só reage ao clique no fundo da coluna, não nos blocos de atendimento */
const onBackground = (e: MouseEvent<HTMLDivElement>) => e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('agenda__line')

/** grade do dia: uma coluna por profissional, com as horas, o expediente, os atendimentos e a linha de agora */
export function TimeGrid({
  professionals,
  workingHours,
  appointments,
  date,
  startHour,
  endHour,
  nowMinutes,
  scrollAnchor,
  scrollKey,
  onSlot,
  onSlotMenu,
  onOpen,
  onMenu,
}: {
  professionals: { id: string; name: string; role?: string }[]
  workingHours: Record<string, HourInterval[]>
  appointments: Appointment[]
  date: Date
  startHour: number
  endHour: number
  /** minutos desde 00:00 se a linha de agora deve aparecer; null caso contrário */
  nowMinutes: number | null
  /** horário (min) onde a rolagem deve começar; null deixa no topo */
  scrollAnchor: number | null
  /** muda quando a rolagem deve ser refeita (outro dia, outro layout) */
  scrollKey: string
  onSlot: (professionalId: string, minutes: number) => void
  onSlotMenu: (e: MouseEvent<HTMLDivElement>, professionalId: string, minutes: number) => void
  onOpen: (id: string) => void
  onMenu: (e: MouseEvent, a: Appointment) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hours = gridHours(startHour, endHour)
  const hasAnchor = scrollAnchor !== null

  useEffect(() => {
    const el = scrollRef.current
    if (!el || scrollAnchor === null) return
    el.scrollTop = scrollTopFor(scrollAnchor, startHour)
  }, [scrollKey, hasAnchor]) // eslint-disable-line react-hooks/exhaustive-deps

  const slotMinutes = (e: MouseEvent<HTMLDivElement>) => minuteAt(e.clientY - e.currentTarget.getBoundingClientRect().top, startHour)

  return (
    <>
      <div className="agenda" style={vars({ '--cols': professionals.length })}>
        <div className="agenda__head">
          <span />
          {professionals.map((p, i) => (
            <div key={p.id} className="agenda__pro" data-tone={proTone(i)}>
              <Avatar name={p.name} size="sm" />
              <div className="agenda__pro-text">
                <p className="agenda__pro-name">{p.name}</p>
                <p className="agenda__pro-role">{p.role}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="agenda__scroll" ref={scrollRef}>
          <div className="agenda__body" style={vars({ '--grid-h': `${gridHeight(startHour, endHour)}px` })}>
            <div className="agenda__hours" aria-hidden="true">
              {hours.map((h) => (
                <span key={h} className="agenda__hour" style={vars({ '--top': `${yFor(h * 60, startHour)}px` })}>
                  {String(h).padStart(2, '0')}:00
                </span>
              ))}
            </div>

            {professionals.map((p) => (
              <div
                key={p.id}
                className="agenda__col agenda__col--click"
                onClick={(e) => onBackground(e) && onSlot(p.id, slotMinutes(e))}
                onContextMenu={(e) => {
                  if (!onBackground(e)) return
                  e.preventDefault()
                  onSlotMenu(e, p.id, slotMinutes(e))
                }}
              >
                {hours.map((h) => (
                  <div key={h} className="agenda__line" style={vars({ '--top': `${yFor(h * 60, startHour)}px` })} />
                ))}
                {closedRanges(workingHours[p.id], date.getDay(), startHour, endHour).map(([from, to]) => (
                  <div
                    key={from}
                    className="agenda__closed"
                    style={vars({ '--top': `${yFor(from, startHour)}px`, '--height': `${((to - from) / 60) * HOUR_HEIGHT}px` })}
                    title="Fora do horário de atendimento"
                  />
                ))}
                {appointments
                  .filter((a) => a.professionalId === p.id)
                  .map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`appt appt--${a.status}`}
                      style={vars({ '--top': `${yFor(a.start, startHour) + 2}px`, '--height': `${blockHeight(a.duration)}px` })}
                      onClick={() => onOpen(a.id)}
                      onContextMenu={(e) => onMenu(e, a)}
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

            {nowMinutes !== null && (
              <div className="agenda__now" style={vars({ '--top': `${yFor(nowMinutes, startHour)}px` })} aria-hidden="true">
                <span className="agenda__now-dot" />
              </div>
            )}
          </div>
        </div>
      </div>

      <ul className="legend" aria-label="Legenda de status">
        <li>
          <span className="legend__dot legend__dot--confirmado" />
          Confirmado
        </li>
        <li>
          <span className="legend__dot legend__dot--pendente" />
          Aguardando
        </li>
        <li>
          <span className="legend__dot legend__dot--atendimento" />
          Em atendimento
        </li>
        <li>
          <span className="legend__dot legend__dot--concluido" />
          Concluído
        </li>
        <li>
          <span className="legend__dot legend__dot--faltou" />
          Faltou
        </li>
      </ul>
    </>
  )
}

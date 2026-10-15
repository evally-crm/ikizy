import './DayAgenda.css'
import { useState } from 'react'
import { ChevronDown, MessageCircle, Plus } from 'lucide-react'
import { formatDuration, type HourInterval } from '../lib/agendaTime'
import { formatBRL, formatTime } from '../lib/format'
import type { Appointment, Professional } from '../types'
import { StatusBadge } from './ui'

/** buraco livre mínimo para aparecer na lista (menos que isso não cabe um atendimento) */
const MIN_GAP = 30

/** o que ainda vai acontecer no dia (não concluído, não faltou) */
const isOpen = (a: Appointment) => a.status === 'pendente' || a.status === 'confirmado' || a.status === 'atendimento'

/** ação do momento de cada status; concluir abre o atendimento, porque pede a forma de pagamento */
const STEP: Partial<Record<Appointment['status'], string>> = {
  pendente: 'Confirmar',
  confirmado: 'Iniciar',
  atendimento: 'Concluir e receber',
}

type Row = { kind: 'appt'; a: Appointment } | { kind: 'gap'; start: number; end: number }

/** horários livres entre os atendimentos, dentro do expediente da profissional (só quando há uma profissional na tela) */
function withGaps(items: Appointment[], hours: HourInterval[] | undefined, weekday: number, from: number): Row[] {
  const open = (hours ?? []).filter((i) => i.weekday === weekday).sort((a, b) => a.start - b.start)
  // sem horário cadastrado não dá para saber o que é livre: só a lista
  if (open.length === 0) return items.map((a) => ({ kind: 'appt', a }))
  const busy = items.map((a) => [a.start, a.start + a.duration] as const)
  const gaps: [number, number][] = []
  for (const i of open) {
    let cursor = Math.max(i.start, from)
    for (const [s, e] of busy) {
      if (e <= cursor || s >= i.end) continue
      if (s - cursor >= MIN_GAP) gaps.push([cursor, s])
      cursor = Math.max(cursor, e)
    }
    if (i.end - cursor >= MIN_GAP) gaps.push([cursor, i.end])
  }
  const all: Row[] = [...items.map((a) => ({ kind: 'appt' as const, a })), ...gaps.map(([start, end]) => ({ kind: 'gap' as const, start, end }))]
  return all.sort((x, y) => (x.kind === 'appt' ? x.a.start : x.start) - (y.kind === 'appt' ? y.a.start : y.start))
}

function ApptRow({
  a,
  proName,
  highlight,
  onOpen,
  onStep,
  onMessage,
}: {
  a: Appointment
  proName: string
  highlight?: boolean
  onOpen: () => void
  onStep?: () => void
  onMessage?: () => void
}) {
  const step = STEP[a.status]
  return (
    <li className={`dayrow ${highlight ? 'dayrow--now' : ''} dayrow--${a.status}`}>
      <button type="button" className="dayrow__main" onClick={onOpen}>
        <span className="dayrow__time">
          <strong>{formatTime(a.start)}</strong>
          <span>{formatDuration(a.duration)}</span>
        </span>
        <span className="dayrow__body">
          <span className="dayrow__name">{a.client}</span>
          <span className="dayrow__meta">
            <StatusBadge status={a.status} />
            <span className="dayrow__detail">
              {a.service}
              {proName && ` · ${proName}`} · {formatBRL(a.price).replace(',00', '')}
            </span>
          </span>
        </span>
      </button>
      {(onMessage || (highlight && step && onStep)) && (
        <span className="dayrow__actions">
          {highlight && step && onStep && (
            <button type="button" className="dayrow__step" onClick={onStep}>
              {step}
            </button>
          )}
          {onMessage && (
            <button type="button" className="dayrow__msg" aria-label={`Mensagem para ${a.client}`} title="Mensagem no WhatsApp" onClick={onMessage}>
              <MessageCircle size={17} aria-hidden="true" />
            </button>
          )}
        </span>
      )}
    </li>
  )
}

/**
 * agenda do dia em lista (padrão no celular): o que está acontecendo agora com a ação do momento,
 * os próximos com os horários livres entre eles, e as já atendidas recolhidas no fim.
 */
export function DayAgenda({
  items,
  professionals,
  showPro,
  hours,
  weekday,
  isToday,
  isPast,
  nowMinutes,
  loading,
  onOpen,
  onStep,
  onMessage,
  onNew,
}: {
  items: Appointment[]
  professionals: Professional[]
  /** mostra o nome da profissional em cada linha (quando a lista tem mais de uma) */
  showPro: boolean
  /** horário da profissional em foco; os buracos livres só aparecem quando há uma só */
  hours?: HourInterval[]
  weekday: number
  isToday: boolean
  isPast: boolean
  nowMinutes: number
  loading: boolean
  onOpen: (a: Appointment) => void
  onStep: (a: Appointment) => void
  onMessage: (a: Appointment) => void
  onNew: (start: number) => void
}) {
  const [showDone, setShowDone] = useState(false)
  const proName = (id: string) => (showPro ? (professionals.find((p) => p.id === id)?.name ?? '') : '')
  const sorted = [...items].sort((a, b) => a.start - b.start)
  const canMessage = (a: Appointment) => Boolean(a.phone.replace(/\D/g, ''))

  // hoje: separa o que já passou do que vem; outros dias: tudo em ordem
  const done = isToday || isPast ? sorted.filter((a) => !isOpen(a) || (isToday && a.start + a.duration <= nowMinutes && a.status !== 'atendimento')) : []
  const ahead = sorted.filter((a) => !done.includes(a))
  const current = isToday
    ? (ahead.find((a) => a.status === 'atendimento') ?? ahead.find((a) => a.start <= nowMinutes + 15))
    : undefined
  const next = ahead.filter((a) => a !== current)
  const rows = hours && !isPast ? withGaps(next, hours, weekday, isToday ? nowMinutes : 0) : next.map((a) => ({ kind: 'appt' as const, a }))

  if (loading) return <p className="dayagenda__empty">Carregando…</p>

  return (
    <section className="dayagenda" aria-label="Atendimentos do dia">
      {current && (
        <>
          <p className="dayagenda__label">Agora</p>
          <ul className="dayagenda__list">
            <ApptRow
              a={current}
              proName={proName(current.professionalId)}
              highlight
              onOpen={() => onOpen(current)}
              onStep={() => onStep(current)}
              onMessage={canMessage(current) ? () => onMessage(current) : undefined}
            />
          </ul>
        </>
      )}

      {(rows.length > 0 || !current) && (
        <>
          {(current || done.length > 0) && rows.length > 0 && <p className="dayagenda__label">{isToday ? 'Próximos' : 'Atendimentos'}</p>}
          {rows.length === 0 && !current ? (
            <div className="dayagenda__empty">
              <p>{isPast ? 'Nenhum atendimento neste dia.' : done.length ? 'Nada mais por hoje.' : 'Nenhum atendimento neste dia.'}</p>
              {!isPast && (
                <button type="button" className="dayagenda__add" onClick={() => onNew(isToday ? Math.ceil(nowMinutes / 15) * 15 : 9 * 60)}>
                  <Plus size={16} aria-hidden="true" /> Agendar
                </button>
              )}
            </div>
          ) : (
            <ul className="dayagenda__list">
              {rows.map((r) =>
                r.kind === 'gap' ? (
                  <li key={`gap-${r.start}`} className="daygap">
                    <button type="button" onClick={() => onNew(r.start)}>
                      <span>
                        {formatTime(r.start)}–{formatTime(r.end)} livre
                      </span>
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </li>
                ) : (
                  <ApptRow
                    key={r.a.id}
                    a={r.a}
                    proName={proName(r.a.professionalId)}
                    highlight={r.a.status === 'pendente'}
                    onOpen={() => onOpen(r.a)}
                    onStep={() => onStep(r.a)}
                    onMessage={canMessage(r.a) ? () => onMessage(r.a) : undefined}
                  />
                ),
              )}
            </ul>
          )}
        </>
      )}

      {done.length > 0 && (
        <>
          <button type="button" className="dayagenda__toggle" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            {isToday ? 'Já atendidas' : 'Atendimentos'} ({done.length})
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {showDone && (
            <ul className="dayagenda__list dayagenda__list--done">
              {done.map((a) => (
                <ApptRow
                  key={a.id}
                  a={a}
                  proName={proName(a.professionalId)}
                  onOpen={() => onOpen(a)}
                  onMessage={canMessage(a) ? () => onMessage(a) : undefined}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

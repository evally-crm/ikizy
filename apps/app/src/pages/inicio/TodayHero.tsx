import { CalendarPlus, Clock, MessageCircle } from 'lucide-react'
import type { DayLoad, DaySummary } from '../../domain/agenda'
import { formatBRL, formatTime } from '../../lib/format'
import type { Appointment } from '../../types'
import './TodayHero.css'

const TICKS = 36
const SWEEP = 270

/** horas e minutos curtos: 300 → "5h", 270 → "4h30" */
const hm = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/** medidor redondo do dia (como o de pressão): tracinhos em arco que acendem conforme a agenda enche */
function DayGauge({ load }: { load: DayLoad }) {
  const lit = Math.round((load.pct / 100) * TICKS)
  return (
    <svg className="gauge" viewBox="0 0 100 100" role="img" aria-label={`Agenda ${load.pct}% ocupada: ${hm(load.booked)} de ${hm(load.capacity)}`}>
      <circle className="gauge__face" cx="50" cy="50" r="49" />
      {Array.from({ length: TICKS }, (_, i) => {
        const angle = ((-SWEEP / 2 + (i / (TICKS - 1)) * SWEEP - 90) * Math.PI) / 180
        const [c, s] = [Math.cos(angle), Math.sin(angle)]
        return (
          <line
            key={i}
            className={i < lit ? 'gauge__tick is-on' : 'gauge__tick'}
            x1={50 + c * 36}
            y1={50 + s * 36}
            x2={50 + c * (i % 6 === 0 ? 44 : 42)}
            y2={50 + s * (i % 6 === 0 ? 44 : 42)}
          />
        )
      })}
      <text className="gauge__value" x="50" y="53" textAnchor="middle">
        {load.pct}
        <tspan className="gauge__of">%</tspan>
      </text>
      <text className="gauge__label" x="50" y="64" textAnchor="middle">
        ocupado
      </text>
      <text className="gauge__end" x="27" y="86" textAnchor="middle">
        0h
      </text>
      <text className="gauge__end" x="73" y="86" textAnchor="middle">
        {hm(load.capacity)}
      </text>
    </svg>
  )
}

/**
 * topo da Início: um número em destaque (o previsto do dia) com o anel do que já foi concluído,
 * uma linha de números pequenos e, embaixo, o próximo atendimento em vermelho e dois atalhos
 * (o medidor mostra a ocupação: horas marcadas contra o expediente)
 */
export function TodayHero({
  summary,
  load,
  toCall,
  professionalName,
  onNext,
  onCall,
  onNew,
}: {
  summary: DaySummary<Appointment>
  load: DayLoad
  /** clientes do filtro "Chamar hoje" (sumidas, aniversário…) */
  toCall: number
  professionalName: (id: string) => string
  onNext: (a: Appointment) => void
  onCall: () => void
  onNew: () => void
}) {
  const { next } = summary
  const pro = next ? professionalName(next.professionalId) : ''

  return (
    <section className="hero" aria-label="Resumo de hoje">
      <div className="hero__summary">
        <div className="hero__top">
          <div>
            <span className="hero__kicker">Hoje</span>
            <strong className="hero__value">{formatBRL(summary.expected).replace(',00', '')}</strong>
            <span className="hero__caption">previsto no dia, sem as faltas</span>
          </div>
          <DayGauge load={load} />
        </div>

        <dl className="hero__row">
          <div>
            <dt>recebido</dt>
            <dd>{formatBRL(load.received).replace(',00', '')}</dd>
          </div>
          <div>
            <dt>livres</dt>
            <dd>{hm(load.free)}</dd>
          </div>
          <div>
            <dt>a confirmar</dt>
            <dd>{summary.awaiting}</dd>
          </div>
        </dl>
      </div>

      <div className="hero__bento">
        <button type="button" className="hero__next" onClick={() => next && onNext(next)} disabled={!next}>
          <span className="hero__label">
            Próximo <Clock size={16} aria-hidden="true" />
          </span>
          {next ? (
            <>
              <strong className="hero__time">{formatTime(next.start)}</strong>
              <span className="hero__who">{next.client}</span>
              <small>{[next.service, pro].filter(Boolean).join(' · ')}</small>
            </>
          ) : (
            <>
              <strong className="hero__time">—</strong>
              <span className="hero__who">Nada por vir hoje</span>
            </>
          )}
        </button>

        <button type="button" className={`hero__pill ${toCall > 0 ? 'is-hot' : ''}`.trim()} onClick={onCall}>
          <span>
            <strong>{toCall}</strong>
            <small>para chamar</small>
          </span>
          <MessageCircle size={18} aria-hidden="true" />
        </button>

        <button type="button" className="hero__pill" onClick={onNew}>
          <span>
            <strong className="hero__pill-title">Agendar</strong>
            <small>horário</small>
          </span>
          <span className="hero__pill-icon">
            <CalendarPlus size={18} aria-hidden="true" />
          </span>
        </button>
      </div>
    </section>
  )
}

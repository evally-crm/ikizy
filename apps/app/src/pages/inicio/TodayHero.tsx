import { CalendarPlus, Clock, Globe } from 'lucide-react'
import type { DaySummary } from '../../domain/agenda'
import { formatBRL, formatTime } from '../../lib/format'
import type { Appointment } from '../../types'
import './TodayHero.css'

const TICKS = 36
const SWEEP = 270

/** medidor redondo do dia (como o de pressão): tracinhos em arco que acendem conforme os atendimentos são concluídos */
function DayGauge({ done, total }: { done: number; total: number }) {
  const lit = total > 0 ? Math.round((done / total) * TICKS) : 0
  return (
    <svg className="gauge" viewBox="0 0 100 100" role="img" aria-label={`${done} de ${total} atendimentos concluídos`}>
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
      <text className="gauge__value" x="50" y="52" textAnchor="middle">
        {done}
        <tspan className="gauge__of">/{total}</tspan>
      </text>
      <text className="gauge__label" x="50" y="64" textAnchor="middle">
        feitos
      </text>
      <text className="gauge__end" x="27" y="86" textAnchor="middle">
        0
      </text>
      <text className="gauge__end" x="73" y="86" textAnchor="middle">
        {total}
      </text>
    </svg>
  )
}

/**
 * topo da Início: um número em destaque (o previsto do dia) com o anel do que já foi concluído,
 * uma linha de números pequenos e, embaixo, o próximo atendimento em vermelho e dois atalhos
 */
export function TodayHero({
  summary,
  upcoming,
  siteRequests,
  professionalName,
  onNext,
  onRequests,
  onNew,
}: {
  summary: DaySummary<Appointment>
  upcoming: number
  siteRequests: number
  professionalName: (id: string) => string
  onNext: (a: Appointment) => void
  onRequests: () => void
  onNew: () => void
}) {
  const { next } = summary
  const pro = next ? professionalName(next.professionalId) : ''

  return (
    <section className="hero" aria-label="Resumo de hoje">
      <div className="hero__top">
        <div>
          <span className="hero__kicker">Hoje</span>
          <strong className="hero__value">{formatBRL(summary.expected).replace(',00', '')}</strong>
          <span className="hero__caption">previsto no dia, sem as faltas</span>
        </div>
        <DayGauge done={summary.concluded} total={summary.count} />
      </div>

      <dl className="hero__row">
        <div>
          <dt>atend.</dt>
          <dd>{summary.count}</dd>
        </div>
        <div>
          <dt>feitos</dt>
          <dd>{summary.concluded}</dd>
        </div>
        <div>
          <dt>a seguir</dt>
          <dd>{upcoming}</dd>
        </div>
      </dl>

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

        <button type="button" className={`hero__pill ${siteRequests > 0 ? 'is-hot' : ''}`.trim()} onClick={onRequests}>
          <span>
            <strong>{siteRequests}</strong>
            <small>{siteRequests === 1 ? 'pedido do site' : 'pedidos do site'}</small>
          </span>
          <Globe size={18} aria-hidden="true" />
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

import type { CSSProperties } from 'react'
import { CalendarPlus, ChevronRight, Clock, Globe } from 'lucide-react'
import type { DaySummary } from '../../domain/agenda'
import { formatBRL, formatTime } from '../../lib/format'
import type { Appointment } from '../../types'
import './TodayHero.css'

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
  const done = summary.count > 0 ? summary.concluded / summary.count : 0
  const pro = next ? professionalName(next.professionalId) : ''

  return (
    <section className="hero" aria-label="Resumo de hoje">
      <div className="hero__top">
        <div>
          <span className="hero__kicker">Hoje</span>
          <strong className="hero__value">{formatBRL(summary.expected).replace(',00', '')}</strong>
          <span className="hero__caption">previsto no dia, sem as faltas</span>
        </div>
        <span
          className="hero__ring"
          role="img"
          aria-label={`${summary.concluded} de ${summary.count} atendimentos concluídos`}
          style={{ '--p': `${Math.round(done * 100)}%` } as CSSProperties}
        />
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
            <small>novo horário</small>
          </span>
          <span className="hero__pill-icon">
            <CalendarPlus size={18} aria-hidden="true" />
          </span>
        </button>
      </div>
      {next && <ChevronRight hidden />}
    </section>
  )
}

import type { MouseEvent } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import { formatBRL, formatTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui'
import type { Appointment } from '../../types'
import './DayList.css'

/** desktop: atendimentos do dia selecionado, ao lado do calendário */
export function DayList({
  date,
  items,
  professionals,
  loading,
  canCreate,
  onOpen,
  onMenu,
  onNew,
}: {
  date: Date
  items: Appointment[]
  professionals: { id: string; name: string }[]
  loading: boolean
  canCreate: boolean
  onOpen: (id: string) => void
  onMenu: (e: MouseEvent, a: Appointment) => void
  onNew: () => void
}) {
  const sorted = [...items].sort((a, b) => a.start - b.start)
  const proName = (id: string) => professionals.find((p) => p.id === id)?.name ?? ''
  return (
    <section className="evcard" aria-label="Atendimentos do dia">
      <div className="evcard__head">
        <h2 className="evcard__title">
          Atendimentos <span>{format(date, "d 'de' MMM", { locale: ptBR }).replace('.', '')}</span>
        </h2>
        <button type="button" className="evcard__new" disabled={!canCreate} onClick={onNew}>
          <Plus size={15} aria-hidden="true" /> Novo
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="evcard__empty">
          {loading ? 'Carregando…' : 'Nenhum atendimento neste dia.'}
          {!loading && <span>Clique em "Novo" ou num horário da grade para agendar.</span>}
        </p>
      ) : (
        <ul className="evcard__list">
          {sorted.map((a) => (
            <li key={a.id}>
              <button type="button" className="ev" onClick={() => onOpen(a.id)} onContextMenu={(e) => onMenu(e, a)}>
                <span className="ev__time">
                  <strong>{formatTime(a.start)}</strong>
                  <span>{a.duration} min</span>
                </span>
                <span className="ev__body">
                  <span className="ev__top">
                    <span className="ev__name">{a.client}</span>
                    <StatusBadge status={a.status} />
                  </span>
                  <span className="ev__meta">
                    {a.service} · {proName(a.professionalId)} · {formatBRL(a.price)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

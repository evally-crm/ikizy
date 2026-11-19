import { Link } from 'react-router-dom'
import { Ban } from 'lucide-react'
import { blockOnDayLabel, type TimeBlock } from '../../domain/schedule'
import { dash } from '../../lib/routes'

/** aviso do dia: folgas, férias e bloqueios que valem para quem aparece na agenda (o site não oferece vagas neles) */
export function BlocksNotice({ blocks, date, professionals }: { blocks: TimeBlock[]; date: string; professionals: { id: string; name: string }[] }) {
  if (blocks.length === 0) return null
  const who = (id: string | null) => (id && professionals.length > 1 ? (professionals.find((p) => p.id === id)?.name ?? '') : '')
  return (
    <ul className="blocks" aria-label="Bloqueios do dia">
      {blocks.map((b) => (
        <li key={b.id} className="blocks__item">
          <Ban size={15} aria-hidden="true" />
          <span>
            <strong>Bloqueado · {blockOnDayLabel(b, date)}</strong>
            {[b.reason, who(b.professionalId)].filter(Boolean).length > 0 && <small> {[b.reason, who(b.professionalId)].filter(Boolean).join(' · ')}</small>}
          </span>
        </li>
      ))}
      <li className="blocks__more">
        <Link className="textlink" to={dash('/negocio#horario')}>
          Ver folgas e bloqueios
        </Link>
      </li>
    </ul>
  )
}

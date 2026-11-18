import type { ReactNode } from 'react'
import './ItemCard.css'

/**
 * item de lista em cartão: um bloco à esquerda (número grande + rótulo), título, uma linha de selos e detalhes,
 * e o valor à direita. Clicar abre o item; sem `onOpen`, é só leitura.
 */
export function ItemCard({
  lead,
  leadLabel,
  title,
  meta,
  trail,
  onOpen,
}: {
  /** o número grande do bloco ("45min", "2") */
  lead: ReactNode
  /** o rótulo pequeno embaixo dele ("Unhas", "serviços") */
  leadLabel?: ReactNode
  title: ReactNode
  meta?: ReactNode
  trail?: ReactNode
  onOpen?: () => void
}) {
  const body = (
    <>
      <span className="itemcard__lead">
        <strong>{lead}</strong>
        {leadLabel && <small>{leadLabel}</small>}
      </span>
      <span className="itemcard__body">
        <span className="itemcard__title">{title}</span>
        {meta && <span className="itemcard__meta">{meta}</span>}
      </span>
      {trail && <span className="itemcard__trail">{trail}</span>}
    </>
  )
  return (
    <li className="itemcard__item">
      {onOpen ? (
        <button type="button" className="itemcard" onClick={onOpen}>
          {body}
        </button>
      ) : (
        <div className="itemcard">{body}</div>
      )}
    </li>
  )
}

/** a lista dos cartões; `empty` aparece quando não há nenhum */
export function ItemCards({ label, empty, children }: { label: string; empty?: ReactNode; children: ReactNode }) {
  const list = Array.isArray(children) ? children.filter(Boolean) : children
  if (Array.isArray(list) && list.length === 0) return <p className="panel__empty">{empty}</p>
  return (
    <ul className="itemcards" aria-label={label}>
      {list}
    </ul>
  )
}

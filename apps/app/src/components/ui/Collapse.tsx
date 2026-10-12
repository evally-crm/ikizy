import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import './Collapse.css'

/** grupo com cabeçalho (título, resumo e selo opcional) que abre e fecha; o estado vem de fora */
export function Collapse({
  title,
  meta,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string
  meta: string
  badge?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className={`grp ${open ? 'is-open' : ''}`.trim()}>
      <button type="button" className="grp__head" aria-expanded={open} onClick={onToggle}>
        <span>
          <strong>
            {title}
            {badge && <span className="grp__badge">{badge}</span>}
          </strong>
          <small>{meta}</small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && <div className="grp__body">{children}</div>}
    </div>
  )
}

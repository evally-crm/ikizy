import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import './Section.css'

/** bloco do editor: título e uma frase curta; abre e fecha para a tela não ficar longa no celular */
export function Section({
  title,
  hint,
  open,
  icon,
  badge,
  children,
}: {
  title: string
  hint?: string
  open?: boolean
  /** ícone num quadradinho à esquerda: ajuda a achar o bloco rápido */
  icon?: ReactNode
  /** estado curto à direita, antes da seta (ex.: 3/5) */
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <details className={`sect ${icon ? 'sect--icon' : ''}`.trim()} open={open}>
      <summary className="sect__head">
        {icon && (
          <span className="sect__icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="sect__text">
          <strong>{title}</strong>
          {hint && <small>{hint}</small>}
        </span>
        {badge}
        <span className="sect__chev" aria-hidden="true">
          <ChevronDown size={16} />
        </span>
      </summary>
      <div className="form">{children}</div>
    </details>
  )
}

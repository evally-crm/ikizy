import type { ReactNode } from 'react'
import './FinPanel.css'

/** seção do financeiro: etiqueta, título, ação à direita e o conteúdo */
export function FinPanel({
  eyebrow,
  title,
  action,
  className = '',
  children,
}: {
  eyebrow?: string
  title: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`finpanel ${className}`.trim()}>
      <header className="finpanel__head">
        <div>
          {eyebrow && <p className="finpanel__eyebrow">{eyebrow}</p>}
          <h2 className="finpanel__title">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

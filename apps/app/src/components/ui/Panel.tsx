import type { ReactNode } from 'react'
import './Panel.css'

/** seção de uma tela: etiqueta, título, ação à direita e o conteúdo */
export function Panel({
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
    <section className={`panel ${className}`.trim()}>
      <header className="panel__head">
        <div>
          {eyebrow && <p className="panel__eyebrow">{eyebrow}</p>}
          <h2 className="panel__title">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

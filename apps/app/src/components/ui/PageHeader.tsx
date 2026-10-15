import type { ReactNode } from 'react'
import './PageHeader.css'

/** cabeçalho de página: título, migalha e as ações da tela à direita */
export function PageHeader({ title, crumb, actions }: { title: ReactNode; crumb?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="pageheader">
      <div className="pageheader__text">
        <h1 className="pageheader__title">{title}</h1>
        {crumb && <p className="pageheader__crumb">{crumb}</p>}
      </div>
      {actions && <div className="pageheader__actions">{actions}</div>}
    </header>
  )
}

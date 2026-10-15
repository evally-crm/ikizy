import { createContext, useContext, type ReactNode } from 'react'
import './PageHeader.css'

/** o que o app põe ao lado do título no celular (o sininho), já que lá não há barra no topo */
export const PageHeaderShell = createContext<ReactNode>(null)

/** cabeçalho de página: título, migalha e as ações da tela à direita */
export function PageHeader({
  title,
  crumb,
  actions,
  className,
}: {
  title: ReactNode
  crumb?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const shell = useContext(PageHeaderShell)
  return (
    <header className={`pageheader ${className ?? ''}`.trim()}>
      <div className="pageheader__text">
        <h1 className="pageheader__title">{title}</h1>
        {crumb && <p className="pageheader__crumb">{crumb}</p>}
      </div>
      {/* sininho fora das ações: no celular fica sempre na linha do título, e as ações descem para a linha de baixo */}
      {shell && <div className="pageheader__shell">{shell}</div>}
      {actions && <div className="pageheader__actions">{actions}</div>}
    </header>
  )
}

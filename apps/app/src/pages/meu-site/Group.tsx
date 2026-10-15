import type { ReactNode } from 'react'
import './MeuSite.css'

/** bloco de ajustes: título pequeno fora do cartão e o conteúdo num cartão branco (como as telas de configuração) */
export function Group({ title, action, flat, children }: { title: string; action?: ReactNode; flat?: boolean; children: ReactNode }) {
  return (
    <section className="sgroup">
      <header className="sgroup__head">
        <h3 className="sgroup__title">{title}</h3>
        {action}
      </header>
      <div className={`sgroup__card ${flat ? 'sgroup__card--flat' : ''}`.trim()}>{children}</div>
    </section>
  )
}

/** linha de ajuste: nome e dica à esquerda, o controle à direita; linhas seguidas ganham um fio entre elas */
export function SettingRow({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="srow">
      <label className="srow__text" htmlFor={htmlFor}>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </label>
      <div className="srow__control">{children}</div>
    </div>
  )
}

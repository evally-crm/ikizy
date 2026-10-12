import type { ReactNode } from 'react'
import './Tabs.css'

export interface TabItem<T extends string> {
  id: T
  label: ReactNode
  /** número ou ícone pequeno ao lado do rótulo */
  badge?: ReactNode
  /** nome para leitores de tela quando o rótulo é só um ícone */
  ariaLabel?: string
}

/** abas em pílula: uma opção ativa por vez (período, mês, seção) */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  fill = false,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  /** nome da lista de abas para leitores de tela */
  label: string
  /** as abas dividem a largura toda (celular) */
  fill?: boolean
}) {
  return (
    <div className={`tabs ${fill ? 'tabs--fill' : ''}`.trim()} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button key={item.id} type="button" role="tab" className="tabs__item" aria-selected={item.id === value} aria-label={item.ariaLabel} title={item.ariaLabel} onClick={() => onChange(item.id)}>
          {item.label}
          {item.badge !== undefined && item.badge !== null && <span className="tabs__badge">{item.badge}</span>}
        </button>
      ))}
    </div>
  )
}

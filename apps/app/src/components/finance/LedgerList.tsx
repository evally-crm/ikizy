import type { ReactNode } from 'react'
import './LedgerList.css'

export interface LedgerRow {
  id: string
  /** hora, data ou avatar à esquerda */
  lead?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  value: ReactNode
  /** botão pequeno no fim da linha (ex.: apagar) */
  action?: ReactNode
}

/** lista de lançamentos: quem/o quê, detalhe e valor, com uma ação opcional por linha */
export function LedgerList({ rows }: { rows: LedgerRow[] }) {
  return (
    <ul className="ledger">
      {rows.map((r) => (
        <li key={r.id} className="ledger__row">
          {r.lead && <span className="ledger__lead">{r.lead}</span>}
          <span className="ledger__text">
            <span className="ledger__title">{r.title}</span>
            {r.subtitle && <small className="ledger__subtitle">{r.subtitle}</small>}
          </span>
          <strong className="ledger__value">{r.value}</strong>
          {r.action}
        </li>
      ))}
    </ul>
  )
}

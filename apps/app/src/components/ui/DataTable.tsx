import type { ReactNode } from 'react'
import './DataTable.css'
import { EmptyBunny } from '../BunnyMark'

export interface Column<T> {
  key: string
  label: string
  align?: 'left' | 'right'
  /** some em telas estreitas (a informação principal fica na primeira coluna) */
  hideOnMobile?: boolean
  render: (row: T) => ReactNode
}

/** tabela de listagem: clique (ou Enter) na linha abre o item */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  caption,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** o que mostrar quando não há linhas */
  empty?: ReactNode
  /** nome da tabela para leitores de tela */
  caption: string
}) {
  if (rows.length === 0 && empty) return (
      <div className="datatable__empty">
        <EmptyBunny />
        {empty}
      </div>
    )
  const cellClass = (c: Column<T>) => [c.align === 'right' && 'is-right', c.hideOnMobile && 'is-optional'].filter(Boolean).join(' ') || undefined
  return (
    <div className="datatable">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cellClass(c)} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? 'is-clickable' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={cellClass(c)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

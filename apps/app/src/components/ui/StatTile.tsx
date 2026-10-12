import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import './StatTile.css'

/** cartão de número: rótulo, valor grande, dica e, se houver, a variação sobre o período anterior */
export function StatTile({
  label,
  value,
  hint,
  trend,
  tone = 'default',
  children,
  className = '',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** variação em %, já calculada (positiva ou negativa) com a comparação por extenso */
  trend?: { percent: number; versus: string } | null
  tone?: 'default' | 'dark' | 'brand'
  children?: ReactNode
  className?: string
}) {
  const up = trend ? trend.percent >= 0 : true
  return (
    <section className={`stattile stattile--${tone} ${className}`.trim()}>
      <header className="stattile__head">
        <p className="stattile__label">{label}</p>
        {trend && (
          <span className={`stattile__trend ${up ? 'stattile__trend--up' : 'stattile__trend--down'}`}>
            {up ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
            {up ? '+' : ''}
            {trend.percent}% vs {trend.versus}
          </span>
        )}
      </header>
      <div className="stattile__value">{value}</div>
      {hint && <p className="stattile__hint">{hint}</p>}
      {children}
    </section>
  )
}

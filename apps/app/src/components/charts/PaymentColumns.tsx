import type { CSSProperties } from 'react'
import type { PaymentShare } from '../../domain/finance'
import { formatBRL } from '../../lib/format'
import './PaymentColumns.css'

/** uma coluna por forma de pagamento, a maior destacada; `relative` (0–1) já vem do domínio */
export function PaymentColumns({ shares }: { shares: PaymentShare[] }) {
  return (
    <div className="paycols">
      {shares.map((p) => (
        <div key={p.method} className="paycols__col">
          <span className="paycols__value">{formatBRL(p.total).replace(',00', '')}</span>
          <div className="paycols__track">
            <div className={`paycols__bar ${p.top ? 'is-top' : ''}`.trim()} style={{ '--h': `${p.height}%` } as CSSProperties}>
              <span className="paycols__pct">{p.share}%</span>
            </div>
          </div>
          <span className="paycols__label">{p.method}</span>
        </div>
      ))}
    </div>
  )
}

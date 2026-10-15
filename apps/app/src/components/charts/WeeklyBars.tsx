import type { CSSProperties } from 'react'
import { barHeights } from '../../domain/charts'
import type { WeekTotal } from '../../domain/finance'
import { formatBRL } from '../../lib/format'
import './WeeklyBars.css'

/** faturamento por semana: uma barra por semana, a melhor destacada e a semana de hoje marcada */
export function WeeklyBars({ weeks, bestIndex, label }: { weeks: WeekTotal[]; bestIndex: number; label: string }) {
  const heights = barHeights(weeks.map((w) => w.total))
  return (
    <div className="weekbars" role="img" aria-label={label}>
      {weeks.map((w, i) => {
        const state = [w.future && 'is-future', i === bestIndex && 'is-best', w.current && 'is-current'].filter(Boolean).join(' ')
        return (
          <div key={w.label} className="weekbars__col" title={`${w.label}: ${formatBRL(w.total)}`}>
            <div className="weekbars__track">
              <span className={`weekbars__bar ${state}`.trim()} style={{ '--h': `${heights[i]}%` } as CSSProperties} />
            </div>
            <span className="weekbars__label">{w.label}</span>
          </div>
        )
      })}
    </div>
  )
}

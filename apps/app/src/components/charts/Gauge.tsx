import { gaugeDash } from '../../domain/charts'
import './Gauge.css'

const ARC = 'M20 100 A80 80 0 0 1 180 100'
const LENGTH = Math.PI * 80

/** meia-lua com a margem de lucro (valor em %) */
export function Gauge({ value, label }: { value: number; label: string }) {
  return (
    <div className="gauge" role="img" aria-label={label}>
      <svg viewBox="0 0 200 110" aria-hidden="true">
        <path d={ARC} className="gauge__track" pathLength={LENGTH} />
        {value > 0 && <path d={ARC} className="gauge__fill" pathLength={LENGTH} strokeDasharray={gaugeDash(value, LENGTH)} />}
      </svg>
      <span className="gauge__value">
        {value}
        <small>%</small>
      </span>
    </div>
  )
}

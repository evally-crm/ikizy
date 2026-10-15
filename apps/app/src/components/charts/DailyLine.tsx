import { linePoints } from '../../domain/charts'
import './DailyLine.css'

const WIDTH = 300
const HEIGHT = 70

/** linha do faturamento diário; os dias que ainda não chegaram ficam de fora */
export function DailyLine({ values }: { values: (number | null)[] }) {
  return (
    <svg className="dailyline" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      {[0.25, 0.5, 0.75].map((y) => (
        <line key={y} x1="0" x2={WIDTH} y1={HEIGHT * y} y2={HEIGHT * y} className="dailyline__grid" />
      ))}
      <polyline points={linePoints(values, WIDTH, HEIGHT)} className="dailyline__path" />
    </svg>
  )
}

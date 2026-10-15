import type { DayTile } from '../../domain/finance'
import { formatBRL } from '../../lib/format'
import './DayGrid.css'

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

/** mapa do mês: um quadrado por dia, mais escuro quanto mais faturou; clicar abre o recibo do dia */
export function DayGrid({
  leading,
  days,
  onSelect,
}: {
  leading: number
  days: DayTile[]
  onSelect: (date: string) => void
}) {
  return (
    <div className="daygrid">
      {WEEKDAYS.map((w) => (
        <span key={w} className="daygrid__weekday">
          {w}
        </span>
      ))}
      {Array.from({ length: leading }, (_, i) => (
        <span key={`blank-${i}`} aria-hidden="true" />
      ))}
      {days.map((d) => (
        <button
          key={d.date}
          type="button"
          className={`daygrid__day ${d.today ? 'is-today' : ''}`.trim()}
          data-level={d.level}
          disabled={d.future}
          onClick={() => onSelect(d.date)}
          aria-label={`Dia ${d.day}: ${d.value ? formatBRL(d.value) : 'sem faturamento'}`}
        >
          <span className="daygrid__num">{d.day}</span>
          <span className="daygrid__value">{d.value ? formatBRL(d.value).replace(',00', '').replace('R$', '').trim() : ''}</span>
        </button>
      ))}
    </div>
  )
}

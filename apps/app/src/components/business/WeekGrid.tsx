import type { CSSProperties } from 'react'
import { placeBlock, type WeekDayHours } from '../../domain/business'
import { formatTime } from '../../lib/format'
import './WeekGrid.css'

export interface WeekGridRow {
  id: string
  name: string
  days: WeekDayHours[]
  /** horário por extenso ("Seg a Sex · 09:00–18:00"), uma linha por trecho */
  summary: string[]
}

/** a semana de cada profissional: uma coluna por dia, com os blocos de atendimento desenhados na faixa de horas */
export function WeekGrid({ rows, span }: { rows: WeekGridRow[]; span: { from: number; to: number } }) {
  return (
    <div className="weekgrid">
      {rows.map((row) => (
        <article key={row.id} className="weekgrid__row">
          <header className="weekgrid__head">
            <h3 className="weekgrid__name">{row.name}</h3>
            <p className="weekgrid__summary">{row.summary.length ? row.summary.join(' · ') : 'Ainda não definido'}</p>
          </header>
          <div className="weekgrid__cols">
            {row.days.map((day) => (
              <div key={day.weekday} className="weekgrid__col">
                <div className="weekgrid__track">
                  {day.blocks.map((b) => {
                    const place = placeBlock(b, span)
                    return (
                      <span
                        key={`${b.start}-${b.end}`}
                        className="weekgrid__block"
                        title={`${day.label}: ${formatTime(b.start)}–${formatTime(b.end)}`}
                        style={{ '--top': `${place.top}%`, '--height': `${place.height}%` } as CSSProperties}
                      />
                    )
                  })}
                </div>
                <span className="weekgrid__day">{day.label}</span>
              </div>
            ))}
          </div>
        </article>
      ))}
      <p className="weekgrid__scale">
        Faixa mostrada: {formatTime(span.from)} às {formatTime(span.to)}
      </p>
    </div>
  )
}

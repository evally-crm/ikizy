import { useEffect, useMemo, useRef, useState } from 'react'
import { addMonths, format, isSameDay, startOfDay, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { calendarWeeks, isWholeMonth, monthRange, periodPresets, pickDay, type DateRange } from '../../domain/finance'
import './PeriodPicker.css'

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** o período por extenso: "Outubro 2026", "12 de out 2026" ou "1 de out – 15 de out 2026" */
export function periodLabel(range: DateRange): string {
  if (isWholeMonth(range)) return capitalize(format(range.from, 'MMMM yyyy', { locale: ptBR }))
  if (isSameDay(range.from, range.to)) return format(range.from, "d 'de' MMM yyyy", { locale: ptBR })
  const sameYear = range.from.getFullYear() === range.to.getFullYear()
  const start = format(range.from, sameYear ? "d 'de' MMM" : "d 'de' MMM yyyy", { locale: ptBR })
  return `${start} – ${format(range.to, "d 'de' MMM yyyy", { locale: ptBR })}`
}

/** filtro de datas: botão que abre atalhos e um calendário para escolher o primeiro e o último dia */
export function PeriodPicker({
  value,
  onChange,
  today,
  min,
  max,
}: {
  value: DateRange
  onChange: (range: DateRange) => void
  today: Date
  /** primeiro dia com dados */
  min: Date
  /** último dia que pode ser escolhido */
  max: Date
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => startOfMonth(value.from))
  const [anchor, setAnchor] = useState<Date | null>(null)
  const [hover, setHover] = useState<Date | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const weeks = useMemo(() => calendarWeeks(view), [view])
  const presets = useMemo(() => periodPresets(today), [today])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (!open) {
      setView(startOfMonth(value.from))
      setAnchor(null)
      setHover(null)
    }
    setOpen(!open)
  }

  const apply = (range: DateRange) => {
    onChange(range)
    setAnchor(null)
    setOpen(false)
  }

  const clamp = (range: DateRange): DateRange => ({
    from: range.from < startOfDay(min) ? startOfDay(min) : range.from,
    to: range.to > startOfDay(max) ? startOfDay(max) : range.to,
  })

  // período em destaque: o escolhido, ou o que está sendo montado entre o primeiro clique e o mouse
  const shown: DateRange = anchor ? (hover && hover < anchor ? { from: hover, to: anchor } : { from: anchor, to: hover ?? anchor }) : value
  const canPrev = addMonths(view, -1) >= startOfMonth(min)
  const canNext = addMonths(view, 1) <= startOfMonth(max)

  return (
    <div className="periodpicker" ref={root}>
      <button type="button" className="periodpicker__button" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        <CalendarDays size={15} aria-hidden="true" />
        <span>{periodLabel(value)}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div className="periodpicker__pop" role="dialog" aria-label="Escolher período">
          <ul className="periodpicker__presets">
            {presets.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => apply(clamp(p.range))}>
                  {p.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="periodpicker__cal">
            <header className="periodpicker__head">
              <button type="button" aria-label="Mês anterior" disabled={!canPrev} onClick={() => setView(addMonths(view, -1))}>
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <strong>{capitalize(format(view, 'MMMM yyyy', { locale: ptBR }))}</strong>
              <button type="button" aria-label="Próximo mês" disabled={!canNext} onClick={() => setView(addMonths(view, 1))}>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </header>

            <div className="periodpicker__grid" onMouseLeave={() => setHover(null)}>
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="periodpicker__weekday">
                  {w}
                </span>
              ))}
              {weeks.flat().map((d, i) => {
                if (!d) return <span key={`b${i}`} aria-hidden="true" />
                const disabled = d < startOfDay(min) || d > startOfDay(max)
                const inRange = d >= shown.from && d <= shown.to
                const edge = isSameDay(d, shown.from) || isSameDay(d, shown.to)
                const cls = ['periodpicker__day', inRange && 'is-in', edge && 'is-edge', isSameDay(d, today) && 'is-today']
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    className={cls}
                    disabled={disabled}
                    aria-pressed={edge}
                    aria-label={format(d, "d 'de' MMMM yyyy", { locale: ptBR })}
                    onMouseEnter={() => setHover(d)}
                    onClick={() => {
                      const next = pickDay(anchor, d)
                      if (next.range) apply(next.range)
                      else setAnchor(next.anchor)
                    }}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>

            <footer className="periodpicker__foot">
              <span>{anchor ? 'Agora escolha o último dia' : 'Escolha o primeiro e o último dia'}</span>
              <button type="button" onClick={() => apply(clamp(monthRange(view)))}>
                Mês inteiro
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

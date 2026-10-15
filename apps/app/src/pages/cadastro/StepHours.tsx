import { Clock } from 'lucide-react'
import { DAY_CHIPS, HOUR_PRESETS, matchingPreset, timeOptions, toggleDay } from '../../domain/onboarding'
import { formatTime } from '../../lib/format'
import { Ask, Pick, Suggestion, Suggestions } from './Ask'
import './StepHours.css'

const TIMES = timeOptions()

/** "Quando você atende?": dias e horário no mesmo campo, atalhos comuns embaixo */
export function StepHours({
  days,
  start,
  end,
  onChange,
}: {
  days: number[]
  start: number
  end: number
  onChange: (p: { days?: number[]; start?: number; end?: number }) => void
}) {
  const preset = matchingPreset(days, start, end)
  return (
    <>
      <Ask icon={<Clock size={20} />} goLabel="Continuar">
        <span className="onb-days" role="group" aria-label="Dias de atendimento">
          {DAY_CHIPS.map((d) => (
            <button
              key={d.weekday}
              type="button"
              className="onb-days__day"
              aria-pressed={days.includes(d.weekday)}
              aria-label={d.label}
              title={d.label}
              onClick={() => onChange({ days: toggleDay(days, d.weekday) })}
            >
              {d.short}
            </button>
          ))}
        </span>
        <span className="onb-time">
          das
          <Pick label="Abre às" value={start} onChange={(v) => onChange({ start: Number(v) })}>
            {TIMES.map((m) => (
              <option key={m} value={m}>
                {formatTime(m)}
              </option>
            ))}
          </Pick>
          às
          <Pick label="Fecha às" value={end} onChange={(v) => onChange({ end: Number(v) })}>
            {TIMES.map((m) => (
              <option key={m} value={m}>
                {formatTime(m)}
              </option>
            ))}
          </Pick>
        </span>
      </Ask>
      <Suggestions label="Horários comuns">
        {HOUR_PRESETS.map((p) => (
          <Suggestion key={p.id} on={preset === p.id} onClick={() => onChange({ days: p.days, start: p.start, end: p.end })}>
            {p.label}
          </Suggestion>
        ))}
      </Suggestions>
    </>
  )
}

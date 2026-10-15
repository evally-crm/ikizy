import { Clock } from 'lucide-react'
import { DAY_CHIPS, HOUR_PRESETS, matchingPreset, timeOptions, toggleDay } from '../../domain/onboarding'
import { formatTime } from '../../lib/format'
import { Select, type Option } from '../../components/controls'
import { Ask, Suggestion, Suggestions } from './Ask'
import './StepHours.css'

const TIMES: Option[] = timeOptions().map((m) => ({ value: String(m), label: formatTime(m) }))

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
          <Select label="Abre às" hideLabel value={String(start)} options={TIMES} onChange={(v) => onChange({ start: Number(v) })} />
          às
          <Select label="Fecha às" hideLabel value={String(end)} options={TIMES} onChange={(v) => onChange({ end: Number(v) })} />
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

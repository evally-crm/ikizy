import { useMemo, useState } from 'react'
import { Copy, X } from 'lucide-react'
import { useAgenda } from '../data/AgendaProvider'
import { WEEKDAYS, type HourInterval } from '../lib/agendaTime'
import { formatTime } from '../lib/format'
import { Button, Em } from './ui'
import { Select, Switch, type Option } from './controls'
import { Modal } from './Modal'

/** um dia da semana no formulário: expediente e, se houver, a pausa */
interface Day {
  open: boolean
  start: number
  end: number
  pause: boolean
  pauseStart: number
  pauseEnd: number
}

const DEFAULT_DAY: Day = { open: false, start: 9 * 60, end: 18 * 60, pause: false, pauseStart: 12 * 60, pauseEnd: 13 * 60 }
const TIMES: Option[] = Array.from({ length: 33 }, (_, i) => {
  const m = 6 * 60 + i * 30
  return { value: String(m), label: formatTime(m) }
})

/** intervalos salvos -> um Day por dia da semana (0 = domingo) */
function toDays(list: HourInterval[] | undefined): Record<number, Day> {
  const out: Record<number, Day> = {}
  for (const { id } of WEEKDAYS) {
    const parts = (list ?? []).filter((i) => i.weekday === id).sort((a, b) => a.start - b.start)
    if (parts.length === 0) out[id] = { ...DEFAULT_DAY }
    else {
      const first = parts[0]
      const last = parts[parts.length - 1]
      out[id] = {
        open: true,
        start: first.start,
        end: last.end,
        pause: parts.length > 1,
        pauseStart: parts.length > 1 ? first.end : DEFAULT_DAY.pauseStart,
        pauseEnd: parts.length > 1 ? parts[1].start : DEFAULT_DAY.pauseEnd,
      }
    }
  }
  return out
}

/** Days -> intervalos; devolve a mensagem de erro quando algum dia não faz sentido */
function toIntervals(days: Record<number, Day>): { intervals: HourInterval[]; error: string | null } {
  const intervals: HourInterval[] = []
  for (const { id, label } of WEEKDAYS) {
    const d = days[id]
    if (!d.open) continue
    if (d.end <= d.start) return { intervals, error: `${label}: o fechamento precisa ser depois da abertura.` }
    if (d.pause) {
      if (d.pauseEnd <= d.pauseStart || d.pauseStart <= d.start || d.pauseEnd >= d.end) {
        return { intervals, error: `${label}: a pausa precisa começar e terminar dentro do expediente.` }
      }
      intervals.push({ weekday: id, start: d.start, end: d.pauseStart }, { weekday: id, start: d.pauseEnd, end: d.end })
    } else {
      intervals.push({ weekday: id, start: d.start, end: d.end })
    }
  }
  return { intervals, error: null }
}

export function WorkingHoursDialog({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const { professionals, workingHours, hoursAvailable, saveHours } = useAgenda()
  const [proId, setProId] = useState(professionals[0]?.id ?? '')
  // rascunho por profissional: trocar de aba não perde o que foi editado
  const [drafts, setDrafts] = useState<Record<string, Record<number, Day>>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const days = useMemo(() => drafts[proId] ?? toDays(workingHours[proId]), [drafts, proId, workingHours])
  const pro = professionals.find((p) => p.id === proId)
  const configured = (workingHours[proId]?.length ?? 0) > 0

  const patch = (weekday: number, change: Partial<Day>) => {
    setError(null)
    setDrafts((d) => ({ ...d, [proId]: { ...days, [weekday]: { ...days[weekday], ...change } } }))
  }

  const copyFirst = () => {
    const source = WEEKDAYS.map((w) => days[w.id]).find((d) => d.open)
    if (!source) return
    // segunda a sábado recebem o mesmo expediente; domingo fica como está
    const next: Record<number, Day> = { ...days }
    for (const w of WEEKDAYS) if (w.id !== 0) next[w.id] = { ...source }
    setDrafts((d) => ({ ...d, [proId]: next }))
  }

  const onSave = async () => {
    const dirtyIds = Object.keys(drafts)
    if (dirtyIds.length === 0) return onClose()
    setBusy(true)
    for (const id of dirtyIds) {
      const { intervals, error: problem } = toIntervals(drafts[id])
      if (problem) {
        setBusy(false)
        setProId(id)
        return setError(`${professionals.find((p) => p.id === id)?.name}: ${problem}`)
      }
      const message = await saveHours(id, intervals)
      if (message) {
        setBusy(false)
        return setError(message)
      }
    }
    setBusy(false)
    notify('Horários de atendimento salvos')
    onClose()
  }

  return (
    <Modal label="Horário de atendimento" onClose={onClose} wide>
      <div className="dialog__head">
        <div>
          <p className="eyebrow">Agenda</p>
          <h2>
            Horário de <Em>atendimento</Em>
          </h2>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      <p className="dialog__text" style={{ marginTop: 8 }}>
        É dentro desse horário que a agenda oferece vagas, e também o que o cliente vai poder escolher no seu site.
      </p>

      {!hoursAvailable && (
        <p className="dialog__error" role="alert">
          O banco ainda não tem a tabela de horários. Aplique a migration <strong>20261010000000_working_hours</strong> para salvar.
        </p>
      )}

      {professionals.length > 1 && (
        <div className="chips chips--tight" role="group" aria-label="Profissional" style={{ marginBottom: 16 }}>
          {professionals.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={proId === p.id} onClick={() => setProId(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {pro && (
        <>
          {!configured && !drafts[proId] && (
            <p className="field__hint" style={{ marginBottom: 12 }}>
              {pro.name} ainda não tem horário definido. Ligue os dias em que ela atende e escolha abertura e fechamento.
            </p>
          )}

          <ul className="hours">
            {WEEKDAYS.map(({ id, label }) => {
              const d = days[id]
              return (
                <li key={id} className={`hours__row ${d.open ? 'is-open' : ''}`}>
                  <Switch checked={d.open} onChange={(open) => patch(id, { open })} label={label} />
                  {d.open ? (
                    <div className="hours__times">
                      <Select label={`${label}: abre`} hideLabel value={String(d.start)} options={TIMES} onChange={(v) => patch(id, { start: Number(v) })} />
                      <span aria-hidden="true">às</span>
                      <Select label={`${label}: fecha`} hideLabel value={String(d.end)} options={TIMES} onChange={(v) => patch(id, { end: Number(v) })} />
                      <button type="button" className="hours__pause" aria-pressed={d.pause} onClick={() => patch(id, { pause: !d.pause })}>
                        {d.pause ? 'Sem pausa' : '+ Pausa'}
                      </button>
                      {d.pause && (
                        <div className="hours__break">
                          <span>Pausa</span>
                          <Select label={`${label}: pausa começa`} hideLabel value={String(d.pauseStart)} options={TIMES} onChange={(v) => patch(id, { pauseStart: Number(v) })} />
                          <span aria-hidden="true">às</span>
                          <Select label={`${label}: pausa termina`} hideLabel value={String(d.pauseEnd)} options={TIMES} onChange={(v) => patch(id, { pauseEnd: Number(v) })} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="hours__closed">Fechado</span>
                  )}
                </li>
              )
            })}
          </ul>

          <button type="button" className="hours__copy" onClick={copyFirst}>
            <Copy size={14} aria-hidden="true" /> Copiar o primeiro dia aberto para segunda a sábado
          </button>
        </>
      )}

      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}

      <div className="dialog__actions" style={{ marginTop: 22 }}>
        <Button variant="light" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={busy || !hoursAvailable || !pro} onClick={() => void onSave()}>
          {busy ? 'Salvando…' : 'Salvar horários'}
        </Button>
      </div>
    </Modal>
  )
}

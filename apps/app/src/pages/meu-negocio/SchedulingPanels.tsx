import { useState, type FormEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { BUFFER_OPTIONS, bufferLabel, checkBlock, describeBlock, type BlockValue, type TimeBlock } from '../../domain/schedule'
import { Modal } from '../../components/Modal'
import { Select, Switch } from '../../components/controls'
import { Button, Em, Panel } from '../../components/ui'

const todayBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

/** tempo de limpeza ou descanso depois de cada atendimento: o site deixa esse intervalo ao oferecer horários */
export function BufferPanel({ buffer, canManage, onChange }: { buffer: number; canManage: boolean; onChange: (minutes: number) => Promise<string | null> }) {
  const [error, setError] = useState<string | null>(null)
  const options = BUFFER_OPTIONS.map((m) => ({ value: String(m), label: bufferLabel(m) }))
  return (
    <Panel title="Intervalo entre atendimentos">
      <p className="panel__note">Tempo para limpar e se preparar depois de cada atendimento. O site deixa esse intervalo ao oferecer horários.</p>
      <div className="sched__buffer">
        {canManage ? (
          <Select
            label="Intervalo"
            value={String(buffer)}
            options={options}
            onChange={async (v) => setError(await onChange(Number(v)))}
          />
        ) : (
          <p className="panel__note">{bufferLabel(buffer)}</p>
        )}
      </div>
      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}
      <p className="panel__note">Vale para as vagas do site e para quem remarca pelo link. Na agenda, você ainda marca como quiser.</p>
    </Panel>
  )
}

/** folgas, férias e horários em que ninguém (ou uma profissional) não atende */
export function BlocksPanel({
  blocks,
  professionals,
  canManage,
  onAdd,
  onRemove,
}: {
  blocks: TimeBlock[]
  professionals: { id: string; name: string }[]
  canManage: boolean
  onAdd: (value: BlockValue) => Promise<string | null>
  onRemove: (id: string) => Promise<string | null>
}) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameOf = (id: string | null) => (id ? professionals.find((p) => p.id === id)?.name ?? 'Profissional' : professionals.length > 1 ? 'Todas' : '')
  return (
    <Panel
      title="Folgas e bloqueios"
      action={
        canManage ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} aria-hidden="true" /> Bloquear
          </Button>
        ) : null
      }
    >
      <p className="panel__note">Férias, folga ou um horário em que ninguém atende. O site não oferece vagas nesses períodos.</p>
      {blocks.length === 0 ? (
        <p className="panel__empty">Nenhum bloqueio marcado.</p>
      ) : (
        <ul className="sched__list">
          {blocks.map((b) => (
            <li key={b.id} className="sched__row">
              <span>
                <strong>{describeBlock(b)}</strong>
                <small>{[b.reason, nameOf(b.professionalId)].filter(Boolean).join(' · ')}</small>
              </span>
              {canManage && (
                <button
                  type="button"
                  className="chevbtn"
                  aria-label={`Remover o bloqueio de ${describeBlock(b)}`}
                  onClick={async () => setError(await onRemove(b.id))}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}
      {adding && <BlockDialog professionals={professionals} onSave={onAdd} onClose={() => setAdding(false)} />}
    </Panel>
  )
}

function BlockDialog({
  professionals,
  onSave,
  onClose,
}: {
  professionals: { id: string; name: string }[]
  onSave: (value: BlockValue) => Promise<string | null>
  onClose: () => void
}) {
  const [who, setWho] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [startDate, setStartDate] = useState(todayBR)
  const [endDate, setEndDate] = useState(todayBR)
  const [startTime, setStartTime] = useState('12:00')
  const [endTime, setEndTime] = useState('14:00')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const check = checkBlock({ professionalId: who, startDate, endDate, allDay, startTime, endTime, reason })
    if (!check.ok) return setError(check.error)
    setBusy(true)
    const message = await onSave(check.value)
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal label="Novo bloqueio" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog__head">
          <h2>
            Novo <Em>bloqueio</Em>
          </h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="form">
          {professionals.length > 1 && (
            <Select label="Quem não atende" value={who} options={[{ value: '', label: 'Todas' }, ...professionals.map((p) => ({ value: p.id, label: p.name }))]} onChange={setWho} />
          )}
          <Switch checked={allDay} onChange={setAllDay} label="Dia inteiro" hint="Desligado, você escolhe o horário (ex.: almoço extra)." />
          <div className="form__pair">
            <label className="field">
              <span className="field__label">{allDay ? 'De' : 'Dia'}</span>
              <span className="input">
                <input
                  type="date"
                  value={startDate}
                  min={todayBR()}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    if (e.target.value > endDate) setEndDate(e.target.value)
                  }}
                />
              </span>
            </label>
            {allDay ? (
              <label className="field">
                <span className="field__label">Até</span>
                <span className="input">
                  <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
                </span>
              </label>
            ) : (
              <>
                <label className="field">
                  <span className="field__label">Das</span>
                  <span className="input">
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </span>
                </label>
                <label className="field">
                  <span className="field__label">Às</span>
                  <span className="input">
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </span>
                </label>
              </>
            )}
          </div>
          <label className="field">
            <span className="field__label">Motivo (opcional)</span>
            <span className="input">
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={80} placeholder="Férias, curso, consulta…" />
            </span>
          </label>
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button variant="light" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Bloquear'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

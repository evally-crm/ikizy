import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { BusinessDetails } from '../../data/business'
import type { OpenStatus } from '../../domain/business'
import { BusinessPreview } from '../../components/business/BusinessPreview'
import { Button, Panel } from '../../components/ui'
import './MeuNegocio.css'

/** dados do negócio: formulário à esquerda e, ao lado, como a cliente vai ver (muda enquanto se digita) */
export function DetailsPanel({
  details,
  canManage,
  status,
  onSave,
}: {
  details: BusinessDetails
  canManage: boolean
  status: OpenStatus
  onSave: (d: BusinessDetails) => Promise<string | null>
}) {
  // o que a pessoa já digitou por cima dos dados salvos; vazio depois de salvar
  const [edits, setEdits] = useState<Partial<BusinessDetails>>({})
  const form: BusinessDetails = { ...details, ...edits }
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const dirty = (Object.keys(edits) as (keyof BusinessDetails)[]).some((key) => edits[key] !== details[key])
  const set = (key: keyof BusinessDetails) => (e: ChangeEvent<HTMLInputElement>) => setEdits({ ...edits, [key]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const error = await onSave(form)
    setBusy(false)
    if (!error) setEdits({})
    setMessage(error ? { ok: false, text: error } : { ok: true, text: 'Dados salvos. O site usa estes contatos.' })
  }

  return (
    <Panel title="Dados do negócio" eyebrow="Aparecem no seu site e nas mensagens para as clientes">
      <div className="bizdetails">
        <form className="bizdetails__form" onSubmit={submit}>
          <div className="form bizdetails__fields">
            <label className="field">
              <span className="field__label">Nome do negócio</span>
              <span className="input">
                <input value={form.name} onChange={set('name')} required minLength={2} maxLength={60} disabled={!canManage} />
              </span>
            </label>
            <label className="field">
              <span className="field__label">WhatsApp</span>
              <span className="input">
                <input value={form.whatsapp} onChange={set('whatsapp')} inputMode="tel" placeholder="(11) 98765-4321" maxLength={20} disabled={!canManage} />
              </span>
            </label>
            <label className="field">
              <span className="field__label">Instagram</span>
              <span className="input">
                <input value={form.instagram} onChange={set('instagram')} placeholder="@seunegocio" maxLength={40} disabled={!canManage} />
              </span>
            </label>
            <label className="field">
              <span className="field__label">Endereço</span>
              <span className="input">
                <input value={form.address} onChange={set('address')} placeholder="Rua, número, bairro, cidade" maxLength={120} disabled={!canManage} />
              </span>
            </label>
          </div>
          {message && (
            <p className={message.ok ? 'alert alert--ok' : 'dialog__error'} role={message.ok ? 'status' : 'alert'}>
              {message.text}
            </p>
          )}
          {canManage && (
            <div className="bizdetails__actions">
              <Button type="submit" disabled={busy || !dirty}>
                {busy ? 'Salvando…' : 'Salvar dados'}
              </Button>
            </div>
          )}
        </form>
        <BusinessPreview data={form} status={status} />
      </div>
    </Panel>
  )
}

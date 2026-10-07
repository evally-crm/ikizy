import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { Client } from '../data/clients'
import type { ClientDraft, ProfessionalOption } from '../data/useClientBook'
import { Button } from './ui'
import { Switch } from './controls'
import { Modal } from './Modal'

const splitLines = (v: string) =>
  v
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean)

/** cadastro e edição de cliente (o mesmo formulário para os dois) */
export function ClientDialog({
  client,
  professionals,
  onSave,
  onClose,
}: {
  client?: Client
  professionals: ProfessionalOption[]
  onSave: (draft: ClientDraft) => Promise<string | null>
  onClose: () => void
}) {
  const [name, setName] = useState(client?.name ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [birthday, setBirthday] = useState(client?.birthday ? `2000-${client.birthday}` : '')
  const [vip, setVip] = useState(client?.vip ?? false)
  const [professionalId, setProfessionalId] = useState<string | null>(client?.professionalId ?? null)
  const [allergies, setAllergies] = useState(client?.allergies.join(', ') ?? '')
  const [preferences, setPreferences] = useState(client?.preferences.join('\n') ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) {
      setError('Informe o nome da cliente.')
      return
    }
    setBusy(true)
    const err = await onSave({
      name: name.trim(),
      phone: phone.trim(),
      birthday,
      vip,
      professionalId,
      allergies: allergies
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      preferences: splitLines(preferences),
    })
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <Modal label={client ? 'Editar cliente' : 'Nova cliente'} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="dialog__head">
          <h2>{client ? 'Editar cliente' : 'Nova cliente'}</h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="form">
          <label className="field">
            <span className="field__label">Nome</span>
            <span className="input">
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} autoComplete="off" autoFocus />
            </span>
          </label>
          <label className="field">
            <span className="field__label">WhatsApp</span>
            <span className="input">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={20} placeholder="(11) 99999-9999" autoComplete="off" />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Aniversário (opcional)</span>
            <span className="input">
              <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            </span>
          </label>

          {professionals.length > 0 && (
            <div className="field">
              <span className="field__label">Profissional de preferência</span>
              <div className="chips chips--tight" role="group" aria-label="Profissional de preferência">
                {professionals.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="chip"
                    aria-pressed={professionalId === p.id}
                    onClick={() => setProfessionalId(professionalId === p.id ? null : p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="field">
            <span className="field__label">Alergias (separe por vírgula)</span>
            <span className="input">
              <input value={allergies} onChange={(e) => setAllergies(e.target.value)} maxLength={200} placeholder="Formol, amônia" autoComplete="off" />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Preferências (uma por linha)</span>
            <span className="input">
              <textarea value={preferences} onChange={(e) => setPreferences(e.target.value)} rows={3} maxLength={400} />
            </span>
          </label>

          <Switch checked={vip} onChange={setVip} label="Cliente VIP" />
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
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

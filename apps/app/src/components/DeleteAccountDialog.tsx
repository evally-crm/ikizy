import { useState, type FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './ui'

/** confere o que foi digitado sem diferenciar maiúsculas nem espaços nas pontas */
const confirmsText = (typed: string, expected: string) => typed.trim().toLowerCase() === expected.trim().toLowerCase()

/**
 * excluir a conta (LGPD), depois de digitar o nome do negócio (dona) ou "excluir" (equipe).
 * Também serve ao master, para apagar o negócio de outra pessoa (`title`/`text` próprios).
 */
export function DeleteAccountDialog({
  title,
  text,
  expected,
  confirmLabel = 'Excluir conta',
  onDelete,
  onClose,
}: {
  title: string
  text: string
  /** o que precisa ser digitado para liberar o botão */
  expected: string
  confirmLabel?: string
  onDelete: () => Promise<string | null>
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ok = confirmsText(typed, expected)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    setError(null)
    const message = await onDelete()
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <Modal label={title} onClose={busy ? () => undefined : onClose}>
      <form onSubmit={submit}>
        <div className="dialog__head">
          <h2>{title}</h2>
          <Button variant="ghost" size="sm" icon aria-label="Cancelar" onClick={onClose} disabled={busy}>
            <X size={18} />
          </Button>
        </div>
        <p className="dialog__text">{text}</p>
        <label className="field">
          <span className="field__label">
            Para confirmar, digite: <strong>{expected}</strong>
          </span>
          <span className="input">
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </span>
        </label>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button variant="light" onClick={onClose} disabled={busy}>
            Agora não
          </Button>
          <Button type="submit" disabled={!ok || busy}>
            <Trash2 size={16} aria-hidden="true" /> {busy ? 'Excluindo…' : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

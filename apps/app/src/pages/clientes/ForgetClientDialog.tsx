import { useState, type FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import { confirmsClientName } from '../../domain/clients'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/ui'

/** LGPD: apaga os dados pessoais da cliente depois de digitar o nome dela (R-74 e R-75) */
export function ForgetClientDialog({
  name,
  hasHistory,
  onForget,
  onClose,
}: {
  name: string
  hasHistory: boolean
  onForget: () => Promise<string | null>
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ok = confirmsClientName(typed, name)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    const message = await onForget()
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal label="Apagar dados da cliente" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog__head">
          <h2>Apagar dados de {name.split(' ')[0]}?</h2>
          <Button variant="ghost" size="sm" icon aria-label="Cancelar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <p className="dialog__text">
          Contato, ficha, anamnese, assinatura, fotos e anotações são apagados de vez. Não dá para desfazer.
          {hasHistory && ' Os atendimentos continuam no financeiro, sem o nome dela.'}
        </p>
        <label className="field">
          <span>Para confirmar, digite o nome: {name}</span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
        </label>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button variant="ghost" onClick={onClose}>
            Agora não
          </Button>
          <Button type="submit" disabled={!ok || busy}>
            <Trash2 size={16} aria-hidden="true" /> Apagar dados
          </Button>
        </div>
      </form>
    </Modal>
  )
}

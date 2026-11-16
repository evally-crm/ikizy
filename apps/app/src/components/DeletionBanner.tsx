import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** aviso fixo no topo de todas as telas enquanto a exclusão da conta está agendada: com data e o botão de desistir */
export default function DeletionBanner() {
  const { deletionAt, cancelDeletion } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!deletionAt) return null

  const cancel = async () => {
    setBusy(true)
    setError(null)
    const message = await cancelDeletion()
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <div className="billing-banner billing-banner--alert" role="alert">
      <p>
        {error ?? `Sua conta será excluída em ${fmt.format(deletionAt)}. Depois disso, clientes, agenda e site não podem ser recuperados.`}
      </p>
      <button type="button" className="billing-banner__btn" onClick={() => void cancel()} disabled={busy}>
        {busy ? 'Cancelando…' : 'Cancelar exclusão'}
      </button>
    </div>
  )
}

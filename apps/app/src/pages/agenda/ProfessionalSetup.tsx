import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useAgenda } from '../../data/AgendaProvider'
import { neon } from '../../lib/neon'
import { Button, Card } from '../../components/ui'

/** no Solo quem atende é a própria dona: a agenda já nasce com ela, sem perguntar nada */
export function SoloProfessional() {
  const { addProfessional, reload } = useAgenda()
  const { displayName, session, salon } = useAuth()
  const salonId = salon?.id
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const create = useCallback(async () => {
    setError(null)
    // nunca cadastra uma segunda: se o negócio já tem profissional (a lista local pode estar atrasada), só recarrega
    if (neon && salonId) {
      const { data } = await neon.from('professionals').select('id').eq('salon_id', salonId).limit(1)
      if (data && data.length > 0) {
        reload()
        return
      }
    }
    setError(await addProfessional(displayName, '', session?.user.id))
  }, [addProfessional, reload, displayName, session, salonId])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void create()
  }, [create])

  return (
    <Card className="agenda__empty">
      {error ? (
        <>
          <h2 className="card__title">Não deu para preparar sua agenda</h2>
          <p className="dialog__error" role="alert">
            {error}
          </p>
          <Button onClick={() => void create()}>Tentar de novo</Button>
        </>
      ) : (
        <p className="card__sub" role="status">
          Preparando sua agenda…
        </p>
      )}
    </Card>
  )
}

/** planos com equipe: a agenda é organizada por profissional, então a primeira é cadastrada aqui */
export function FirstProfessional() {
  const { addProfessional } = useAgenda()
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const message = await addProfessional(name, title)
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <Card className="agenda__empty">
      <h2 className="card__title">Cadastre quem atende</h2>
      <p className="card__sub">A agenda é organizada por profissional. Comece com a primeira; as outras entram depois.</p>
      <form className="form" onSubmit={onSubmit}>
        <div className="form__pair">
          <label className="field">
            <span className="field__label">Nome</span>
            <span className="input">
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Especialidade (opcional)</span>
            <span className="input">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Nail designer" maxLength={60} />
            </span>
          </label>
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Adicionar profissional'}
        </Button>
      </form>
    </Card>
  )
}

/** recepção ou profissional sem agenda ligada: só avisa (quem cadastra é a dona ou a gerente) */
export function NoAgenda() {
  return (
    <Card className="agenda__empty">
      <h2 className="card__title">Sua agenda ainda não está pronta</h2>
      <p className="card__sub">Peça para a dona do negócio ligar o seu acesso a quem atende, em Meu negócio → Equipe.</p>
    </Card>
  )
}

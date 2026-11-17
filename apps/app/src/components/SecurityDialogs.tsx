import { useEffect, useState, type FormEvent } from 'react'
import { Laptop, Smartphone, X } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './ui'
import { changePassword, listDevices, signOutDevice, signOutOtherDevices } from '../lib/security'
import type { Device } from '../lib/deviceInfo'

/** trocar a senha com a pessoa logada: a atual, a nova (duas vezes) e, se quiser, sair dos outros aparelhos */
export function ChangePasswordDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [others, setOthers] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mismatch = again.length > 0 && next !== again
  const ready = current.length > 0 && next.length >= 8 && next === again && next !== current

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    const message = await changePassword(current, next, others)
    setBusy(false)
    if (message) setError(message)
    else onDone()
  }

  return (
    <Modal label="Alterar senha" onClose={busy ? () => undefined : onClose}>
      <form onSubmit={submit}>
        <div className="dialog__head">
          <h2>Alterar senha</h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose} disabled={busy}>
            <X size={18} />
          </Button>
        </div>
        <div className="form">
          <label className="field">
            <span className="field__label">Senha atual</span>
            <span className="input">
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Nova senha</span>
            <span className="input">
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} />
            </span>
            <span className="field__hint">Pelo menos 8 caracteres.</span>
          </label>
          <label className="field">
            <span className="field__label">Repita a nova senha</span>
            <span className="input">
              <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
            </span>
            {mismatch && <span className="field__hint">As senhas não são iguais.</span>}
          </label>
          <label className="secur__check">
            <input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} />
            <span>Sair dos outros aparelhos (recomendado)</span>
          </label>
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button variant="light" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!ready || busy}>
            {busy ? 'Salvando…' : 'Trocar a senha'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

const when = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** aparelhos conectados: quem está logada vê onde a conta está aberta e encerra o que não reconhece */
export function DevicesDialog({ onClose }: { onClose: () => void }) {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const list = await listDevices()
    setFailed(list === null)
    setDevices(list)
  }

  useEffect(() => {
    void listDevices().then((list) => {
      setFailed(list === null)
      setDevices(list)
    })
  }, [])

  const run = async (key: string, action: () => Promise<string | null>) => {
    setBusy(key)
    setError(null)
    const message = await action()
    if (message) setError(message)
    else await load()
    setBusy(null)
  }

  const others = devices?.filter((d) => !d.current) ?? []

  return (
    <Modal label="Aparelhos conectados" onClose={onClose}>
      <div className="dialog__head">
        <h2>Aparelhos conectados</h2>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <p className="dialog__text">Onde a sua conta está aberta. Se algum não for seu, encerre e troque a senha.</p>

      {devices === null && !failed && <p className="dialog__text">Carregando…</p>}
      {failed && (
        <p className="dialog__error" role="alert">
          Não foi possível carregar os aparelhos agora. Tente de novo em instantes.
        </p>
      )}

      {devices && (
        <ul className="secur__list">
          {devices.map((d) => (
            <li key={d.token} className="secur__device">
              <span className="secur__icon" aria-hidden="true">
                {/iPhone|iPad|Android/.test(d.label) ? <Smartphone size={18} /> : <Laptop size={18} />}
              </span>
              <span className="secur__who">
                <strong>{d.label}</strong>
                <small>{d.current ? 'Este aparelho' : `Entrou em ${when.format(d.since)}`}</small>
              </span>
              {!d.current && (
                <button type="button" className="linklike" disabled={busy !== null} onClick={() => void run(d.token, () => signOutDevice(d.token))}>
                  {busy === d.token ? 'Encerrando…' : 'Encerrar'}
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
      <div className="dialog__actions">
        <Button variant="light" onClick={onClose}>
          Fechar
        </Button>
        {others.length > 0 && (
          <Button disabled={busy !== null} onClick={() => void run('all', signOutOtherDevices)}>
            {busy === 'all' ? 'Encerrando…' : `Sair dos outros ${others.length === 1 ? 'aparelho' : 'aparelhos'}`}
          </Button>
        )}
      </div>
    </Modal>
  )
}

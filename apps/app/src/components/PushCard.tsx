import { useEffect, useState } from 'react'
import { Bell, Download, Smartphone } from 'lucide-react'
import { disablePush, enablePush, pushState, type PushState } from '../lib/push'
import { useInstallAction } from './useInstallAction'

/** Minha conta > "Neste aparelho": instalar o app e ligar o aviso de pedido novo (só quem trata pedidos) */
export function PushCard() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { info, available: canInstall, run: install, dialog: stepsDialog } = useInstallAction(() => void pushState().then(setState))
  const installed = info.installed

  useEffect(() => {
    let alive = true
    void pushState().then((s) => alive && setState(s))
    return () => {
      alive = false
    }
  }, [])

  // nada a oferecer (sem suporte, sem chaves no servidor, sem como instalar e ainda não instalado): o cartão nem aparece
  const hasPushRow = state === 'on' || state === 'off' || state === 'denied' || state === 'needs-install'
  if (state === null || (!hasPushRow && !canInstall && !installed)) return null

  const toggle = async (on: boolean) => {
    setBusy(true)
    setError(null)
    const message = on ? await enablePush() : await disablePush()
    if (message) setError(message)
    setState(await pushState())
    setBusy(false)
  }

  return (
    <section className="conta__card">
      <h2 className="conta__title">Neste aparelho</h2>
      <p className="conta__hint">Instale o IKIZY como um app e receba um aviso assim que chegar um pedido pelo site, mesmo com ele fechado.</p>

      <ul className="settings__list conta__flat">
        {(state === 'off' || state === 'on') && (
          <li>
            <label className="settings__row settings__row--switch">
              <Bell size={19} aria-hidden="true" />
              <span>
                Avisar quando chegar um pedido
                <small className="conta__sub">{state === 'on' ? 'Ligado neste aparelho' : 'Desligado neste aparelho'}</small>
              </span>
              <input type="checkbox" role="switch" checked={state === 'on'} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
              <span className="switch__track" aria-hidden="true" />
            </label>
          </li>
        )}
        {state === 'denied' && (
          <li>
            <p className="settings__row conta__note">
              <Bell size={19} aria-hidden="true" />
              <span>Os avisos estão bloqueados neste aparelho. Libere as notificações do IKIZY nas configurações do navegador e volte aqui.</span>
            </p>
          </li>
        )}
        {canInstall && !installed && (
          <li>
            <button type="button" className="settings__row" onClick={() => void install()}>
              <Download size={19} aria-hidden="true" />
              <span>
                Instalar o app
                <small className="conta__sub">{info.needsSteps ? 'Veja o passo a passo para o iPhone' : 'Abre em tela cheia, como um aplicativo'}</small>
              </span>
            </button>
          </li>
        )}
        {installed && (
          <li>
            <p className="settings__row conta__note">
              <Smartphone size={19} aria-hidden="true" />
              <span>App instalado neste aparelho.</span>
            </p>
          </li>
        )}
      </ul>

      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}
      {stepsDialog}
    </section>
  )
}

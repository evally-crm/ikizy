import { useEffect, useState } from 'react'
import { Share, Smartphone, X } from 'lucide-react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { canPrompt, isIos, isStandalone, onInstallChange, promptInstall } from '../lib/install'
import { Button } from './ui'

const HIDE_KEY = 'ikizy:instalar-escondido'

function hiddenBefore() {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

/** faixa no Início (só no celular) convidando a pôr o IKIZY na tela inicial */
export default function InstallApp() {
  const isPhone = useMediaQuery('(max-width: 767px)')
  const [available, setAvailable] = useState(canPrompt)
  const [hidden, setHidden] = useState(hiddenBefore)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => onInstallChange(() => setAvailable(canPrompt())), [])

  const ios = isIos()
  if (!isPhone || hidden || isStandalone() || (!available && !ios)) return null

  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, '1')
    } catch {
      /* some só nesta visita */
    }
    setHidden(true)
  }

  return (
    <div className="install" role="region" aria-label="Instalar o app">
      <span className="install__icon" aria-hidden="true">
        <Smartphone size={18} />
      </span>
      <div className="install__text">
        <p className="install__title">Tenha o IKIZY na tela inicial</p>
        {showIosHelp ? (
          <p className="install__sub">
            Toque em <Share size={13} aria-label="Compartilhar" /> <strong>Compartilhar</strong> na barra do Safari e depois em{' '}
            <strong>Adicionar à Tela de Início</strong>.
          </p>
        ) : (
          <p className="install__sub">Abre como app, em tela cheia, sem procurar o link.</p>
        )}
      </div>
      {!showIosHelp && (
        <Button size="sm" onClick={() => (ios ? setShowIosHelp(true) : void promptInstall().then((ok) => ok && hide()))}>
          Instalar
        </Button>
      )}
      <button type="button" className="install__x" aria-label="Agora não" onClick={hide}>
        <X size={16} />
      </button>
    </div>
  )
}

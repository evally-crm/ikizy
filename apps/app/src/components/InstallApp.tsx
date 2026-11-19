import { Plus, Share, X } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './ui'
import './InstallApp.css'

/** passo a passo para o iPhone, onde o navegador não tem botão de instalar */
export function InstallStepsDialog({ onClose, ios }: { onClose: () => void; ios: boolean }) {
  return ios ? <IosSteps onClose={onClose} /> : <OtherSteps onClose={onClose} />
}

/** navegadores sem botão de instalar (Firefox, Safari no Mac, ou o Chrome ainda sem liberar): pelo menu do navegador */
function OtherSteps({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Instalar o app" onClose={onClose}>
      <div className="dialog__head">
        <h2>Instalar o app</h2>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <p className="dialog__text">Seu navegador não abriu o instalador sozinho. Dá para instalar pelo menu dele.</p>
      <ol className="install-steps">
        <li>
          <span className="install-steps__n">1</span>
          <span>
            No <strong>Chrome</strong> ou <strong>Edge</strong>, abra o menu (três pontinhos) ou olhe a barra de endereço.
          </span>
        </li>
        <li>
          <span className="install-steps__n">2</span>
          <span>
            Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
          </span>
        </li>
        <li>
          <span className="install-steps__n">3</span>
          <span>Confirme e abra o IKIZY pelo ícone novo.</span>
        </li>
      </ol>
      <div className="dialog__actions">
        <Button onClick={onClose}>Entendi</Button>
      </div>
    </Modal>
  )
}

function IosSteps({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Instalar o app" onClose={onClose}>
      <div className="dialog__head">
        <h2>Instalar no iPhone</h2>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <p className="dialog__text">Leva 10 segundos. Use o Safari.</p>
      <ol className="install-steps">
        <li>
          <span className="install-steps__n">1</span>
          <span>
            Toque em <strong>Compartilhar</strong> <Share size={16} aria-hidden="true" className="install-steps__icon" /> na barra do Safari.
          </span>
        </li>
        <li>
          <span className="install-steps__n">2</span>
          <span>
            Role e toque em <strong>Adicionar à Tela de Início</strong> <Plus size={16} aria-hidden="true" className="install-steps__icon" />.
          </span>
        </li>
        <li>
          <span className="install-steps__n">3</span>
          <span>
            Toque em <strong>Adicionar</strong>. Depois abra o IKIZY pelo ícone novo na tela do celular.
          </span>
        </li>
      </ol>
      <div className="dialog__actions">
        <Button onClick={onClose}>Entendi</Button>
      </div>
    </Modal>
  )
}

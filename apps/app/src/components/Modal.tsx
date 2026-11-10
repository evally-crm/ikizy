import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { useOverlay } from '../hooks/useOverlay'
import { Button } from './ui'

/** janela sobre a tela; Esc e clique fora fecham */
export function Modal({
  label,
  onClose,
  wide,
  children,
}: {
  label: string
  onClose: () => void
  wide?: boolean
  children: ReactNode
}) {
  useOverlay(onClose)

  // no body: dentro do conteúdo da página, a barra de baixo ficava por cima da janela
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div
        className={`dialog ${wide ? 'dialog--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** aviso de resultado (deu certo / deu errado) no lugar de uma faixa solta na página; um botão só para fechar */
export function NoticeDialog({
  tone,
  title,
  text,
  closeLabel = 'Entendi',
  onClose,
}: {
  tone: 'ok' | 'error'
  title: string
  text: string
  closeLabel?: string
  onClose: () => void
}) {
  const Icon = tone === 'ok' ? Check : X
  return (
    <Modal label={title} onClose={onClose}>
      <div className="notice">
        <span className={`notice__icon notice__icon--${tone}`} aria-hidden="true">
          <Icon size={26} strokeWidth={2.4} />
        </span>
        <h2 className="notice__title">{title}</h2>
        <p className="notice__text">{text}</p>
      </div>
      <div className="dialog__actions">
        <Button onClick={onClose}>{closeLabel}</Button>
      </div>
    </Modal>
  )
}

/** confirmação de ação sem volta (cancelar, apagar), no lugar do confirm do navegador */
export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  text: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal label={title} onClose={onClose}>
      <div className="dialog__head">
        <h2>{title}</h2>
      </div>
      <p className="dialog__text" style={{ marginTop: 10 }}>
        {text}
      </p>
      <div className="dialog__actions">
        <Button variant="light" onClick={onClose}>
          Voltar
        </Button>
        <Button
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

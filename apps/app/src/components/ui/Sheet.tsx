import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlay } from '../../hooks/useOverlay'
import './Sheet.css'

/**
 * folha que desce do topo sobre a tela (recibos, detalhes): Esc, clique fora e o X fecham.
 * `actions` fica numa barra fixa embaixo; o conteúdo rola por dentro.
 */
export function Sheet({
  label,
  onClose,
  actions,
  children,
}: {
  label: string
  onClose: () => void
  actions?: ReactNode
  children: ReactNode
}) {
  useOverlay(onClose)

  return createPortal(
    <div className="sheet" onClick={onClose}>
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sheet__close" aria-label="Fechar" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
        <div className="sheet__body">{children}</div>
        {actions && <div className="sheet__actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}

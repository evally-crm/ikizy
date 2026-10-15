import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Studio } from '../../data/catalog'
import { useOverlay } from '../../hooks/useOverlay'
import SiteFrame from '../../components/SiteFrame'
import './PreviewSheet.css'

/** prévia do site no celular: sobe de baixo por cima do editor e fecha com um toque (o editor continua onde estava) */
export function PreviewSheet({ studio, host, onClose }: { studio: Studio; host: string; onClose: () => void }) {
  useOverlay(onClose)

  return createPortal(
    <div className="sprev" role="dialog" aria-modal="true" aria-label="Prévia do site">
      <header className="sprev__bar">
        <div className="sprev__title">
          <strong>Prévia</strong>
          <small>{host}</small>
        </div>
        <button type="button" className="sprev__close" aria-label="Fechar a prévia" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="sprev__body">
        <SiteFrame studio={studio} device="mobile" height="fill" />
      </div>
    </div>,
    document.body,
  )
}

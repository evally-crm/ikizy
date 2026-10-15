import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlay } from '../../hooks/useOverlay'
import { usePresence } from '../../hooks/usePresence'

/** folha de detalhe de um bloco do mês: sobe de baixo com o número grande e o gráfico (fecha com o caminho inverso) */
export function FinSheet({
  open,
  kicker,
  value,
  label,
  text,
  onClose,
  children,
}: {
  open: boolean
  kicker: string
  value: string
  label: string
  text?: ReactNode
  onClose: () => void
  children?: ReactNode
}) {
  const { mounted, closing } = usePresence(open)
  if (!mounted) return null
  // no corpo da página: fora da área de conteúdo, a folha fica por cima da barra de baixo
  return createPortal(<FinSheetBody {...{ closing, kicker, value, label, text, onClose, children }} />, document.body)
}

function FinSheetBody({
  closing,
  kicker,
  value,
  label,
  text,
  onClose,
  children,
}: {
  closing: boolean
  kicker: string
  value: string
  label: string
  text?: ReactNode
  onClose: () => void
  children?: ReactNode
}) {
  useOverlay(onClose)
  return (
    <div className={`overlay ${closing ? 'is-closing' : ''}`.trim()} onClick={onClose}>
      <div className="dialog dialog--fin" role="dialog" aria-modal="true" aria-label={`${label}: ${value}`} onClick={(e) => e.stopPropagation()}>
        <span className="finsheet__grab" aria-hidden="true" />
        <div className="finsheet__head">
          <span className="finsheet__kicker">{kicker}</span>
          <button type="button" className="finsheet__close" aria-label="Fechar" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <strong className="finsheet__value">{value}</strong>
        <span className="finsheet__label">{label}</span>
        {text && <p className="finsheet__text">{text}</p>}
        {children}
      </div>
    </div>
  )
}

/** cartão de gráfico dentro da folha */
export function FinChart({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="finsheet__chart">
      <h3>
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

import { Lock, X } from 'lucide-react'
import type { MonthClosing } from '../../domain/finance'
import { Modal } from '../../components/Modal'
import { Button, Em } from '../../components/ui'
import { formatBRL } from '../../lib/format'

/** confirmação do fechamento do mês: mostra os números que ficam travados */
export function CloseDialog({ month, onCancel, onConfirm }: { month: MonthClosing; onCancel: () => void; onConfirm: () => void }) {
  const unfinished = month.isCurrent && month.elapsedDays < month.daysInMonth
  return (
    <Modal label={`Fechar ${month.label}`} onClose={onCancel}>
      <div className="dialog__head">
        <div>
          <p className="eyebrow">Fechamento</p>
          <h2>
            Fechar <Em>{month.label}</Em>?
          </h2>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Cancelar" onClick={onCancel}>
          <X size={18} />
        </Button>
      </div>
      <dl className="dialog__grid">
        <div>
          <dt>Faturamento bruto</dt>
          <dd>{formatBRL(month.gross)}</dd>
        </div>
        <div>
          <dt>Lucro líquido</dt>
          <dd>{formatBRL(month.net)}</dd>
        </div>
        {month.commissionsTotal > 0 && (
          <div>
            <dt>Comissões a pagar</dt>
            <dd>{formatBRL(month.commissionsTotal)}</dd>
          </div>
        )}
        <div>
          <dt>Atendimentos</dt>
          <dd>{month.appointments}</dd>
        </div>
      </dl>
      <p className="dialog__text">
        Ao fechar, os atendimentos e as saídas de {month.label} ficam travados e o recibo guarda estes números. Não dá para desfazer.
        {unfinished && ' Atenção: o mês ainda não terminou.'}
      </p>
      <div className="dialog__actions">
        <Button variant="ghost" onClick={onCancel}>
          Agora não
        </Button>
        <Button onClick={onConfirm}>
          <Lock size={16} aria-hidden="true" /> Fechar mês
        </Button>
      </div>
    </Modal>
  )
}

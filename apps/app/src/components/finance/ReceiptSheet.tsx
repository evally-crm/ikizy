import type { ReactNode } from 'react'
import { Download, Send } from 'lucide-react'
import { receiptSummaryText, type ReceiptModel } from '../../domain/finance'
import { Button, Sheet } from '../ui'
import { Invoice } from './Invoice'

/** recibo numa folha que desce do topo, com as ações de guardar e compartilhar (e outras da tela, em `extra`) */
export function ReceiptSheet({ model, onClose, extra }: { model: ReceiptModel; onClose: () => void; extra?: ReactNode }) {
  return (
    <Sheet
      label={`${model.title}: ${model.period}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="soft" size="sm" onClick={() => window.print()}>
            <Download size={15} aria-hidden="true" /> Salvar PDF
          </Button>
          <a
            className="btn btn--soft btn--sm"
            href={`https://wa.me/?text=${encodeURIComponent(receiptSummaryText(model))}`}
            target="_blank"
            rel="noreferrer"
          >
            <Send size={15} aria-hidden="true" /> WhatsApp
          </a>
          {extra}
        </>
      }
    >
      <Invoice model={model} />
    </Sheet>
  )
}

import type { ReceiptModel } from '../../domain/finance'
import { Receipt } from './Receipt'
import './ReceiptPrinter.css'

/** o recibo saindo de uma fenda de impressora; trocar `printKey` imprime de novo */
export function ReceiptPrinter({ model, printKey = 0 }: { model: ReceiptModel; printKey?: number }) {
  return (
    <div className="printer">
      <div className="printer__slot" aria-hidden="true" />
      <div className="printer__out">
        <div key={printKey} className="printer__paper">
          <Receipt model={model} />
        </div>
      </div>
    </div>
  )
}

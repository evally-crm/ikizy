import { useState, type FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import type { Product } from '../../data/catalog'
import { toMoneyInput } from '../../lib/format'
import { MoneyField, parseMoney } from '../../components/controls'
import { Modal } from '../../components/Modal'
import { Button, Em } from '../../components/ui'

/** cria ou edita um material (gasto médio por mês, só para o cálculo de sobra) */
export function ProductDialog({
  product,
  onSave,
  onRemove,
  onClose,
}: {
  product: Product | null
  onSave: (input: Pick<Product, 'name' | 'monthlySpend'>) => Promise<string | null>
  onRemove?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [spend, setSpend] = useState(toMoneyInput(product?.monthlySpend ?? 0))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const message = await onSave({ name, monthlySpend: parseMoney(spend) })
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal label={product ? 'Editar material' : 'Novo material'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog__head">
          <h2>
            {product ? 'Editar' : 'Novo'} <Em>material</Em>
          </h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="form">
          <label className="field">
            <span className="field__label">Nome</span>
            <span className="input">
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoFocus={!product} placeholder="Ex.: Gel e esmaltes" />
            </span>
          </label>
          <MoneyField label="Gasto médio por mês" value={spend} onChange={setSpend} />
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          {onRemove ? (
            <Button variant="light" onClick={onRemove}>
              <Trash2 size={16} aria-hidden="true" /> Apagar
            </Button>
          ) : (
            <Button variant="light" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

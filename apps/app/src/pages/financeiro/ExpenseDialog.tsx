import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { checkExpense, defaultExpenseDate, type MonthClosing } from '../../domain/finance'
import { Modal } from '../../components/Modal'
import { Button, Em } from '../../components/ui'

/** lança uma saída (aluguel, luz, material) dentro do mês exibido */
export function ExpenseDialog({
  month,
  onSave,
  onClose,
}: {
  month: MonthClosing
  onSave: (input: { date: string; description: string; amount: number }) => Promise<string | null>
  onClose: () => void
}) {
  const [date, setDate] = useState(() => defaultExpenseDate(month.date, month.isCurrent, new Date()))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const check = checkExpense({ description, amount, date }, month.id, month.label)
    if (!check.ok) return setError(check.error)
    setBusy(true)
    const message = await onSave(check.value)
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal label="Nova saída" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog__head">
          <h2>
            Nova <Em>saída</Em>
          </h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="form">
          <label className="field">
            <span className="field__label">Descrição</span>
            <span className="input">
              <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={80} placeholder="Aluguel, esmaltes, luz…" autoFocus />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Valor</span>
            <span className="input">
              <span className="wiz__cur">R$</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ''))} inputMode="decimal" placeholder="0,00" />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Data</span>
            <span className="input">
              <input type="date" value={date} min={`${month.id}-01`} onChange={(e) => setDate(e.target.value)} />
            </span>
          </label>
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button variant="light" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Lançar saída'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

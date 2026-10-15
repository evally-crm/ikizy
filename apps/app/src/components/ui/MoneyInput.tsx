import { parseAmount } from '../../domain/site'

/** campo de valor em reais (número inteiro ou com centavos); vazio quando zero */
export function MoneyInput({ id, value, onChange, label }: { id?: string; value: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="input input--money">
      <span aria-hidden="true">R$</span>
      <input
        id={id}
        aria-label={id ? undefined : label}
        type="number"
        inputMode="decimal"
        min={0}
        step="1"
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => onChange(parseAmount(e.target.value))}
      />
    </span>
  )
}

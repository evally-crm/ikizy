import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Check, ChevronDown, Minus, Plus } from 'lucide-react'

/** fecha o que estiver aberto ao clicar fora */
export function useOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onOutside()
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, onOutside, active])
}

export interface Option {
  value: string
  label: string
  hint?: string
}

/** lista de escolha própria (no lugar do select do navegador) */
export function Select({
  label,
  value,
  options,
  onChange,
  hideLabel,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  /** o rótulo continua para leitores de tela, mas não aparece */
  hideLabel?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false), open)

  const index = Math.max(
    options.findIndex((o) => o.value === value),
    0,
  )
  const current = options.find((o) => o.value === value)

  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setHi(index)
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((h) => Math.min(h + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (options[hi]) choose(options[hi].value)
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div className="field" ref={ref}>
      <span className={`field__label ${hideLabel ? 'sr-only' : ''}`}>{label}</span>
      <div className="pick">
        <button
          type="button"
          className="input pick__btn"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setHi(index)
            setOpen((o) => !o)
          }}
          onKeyDown={onKey}
        >
          <span className="pick__value">{current?.label ?? 'Escolher'}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {open && (
          <ul className="pick__list" role="listbox" aria-label={label}>
            {options.map((o, i) => (
              <li key={o.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`pick__opt ${i === hi ? 'is-hi' : ''}`}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => choose(o.value)}
                >
                  <span>{o.label}</span>
                  {o.hint && <small>{o.hint}</small>}
                  {o.value === value && <Check size={15} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** campo de nome com sugestões das clientes cadastradas */
export function ClientField({
  label,
  value,
  onChange,
  clients,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  clients: { id: string; name: string; phone: string }[]
  hint?: string
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false), open)

  const q = value.trim().toLowerCase()
  const matches = q
    ? clients.filter((c) => c.name.toLowerCase().includes(q) && c.name.toLowerCase() !== q).slice(0, 5)
    : clients.slice(0, 5)
  const show = open && matches.length > 0

  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
  }

  const onKey = (e: KeyboardEvent) => {
    if (!show) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(matches[hi].name)
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div className="field" ref={ref}>
      <span className="field__label">{label}</span>
      <div className="pick">
        <span className="input">
          <input
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setHi(0)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder="Nome da cliente"
            autoComplete="off"
            maxLength={120}
            role="combobox"
            aria-expanded={show}
            aria-autocomplete="list"
          />
        </span>
        {show && (
          <ul className="pick__list" role="listbox" aria-label="Clientes">
            {matches.map((c, i) => (
              <li key={c.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === hi}
                  className={`pick__opt ${i === hi ? 'is-hi' : ''}`}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(c.name)}
                >
                  <span>{c.name}</span>
                  {c.phone && <small>{c.phone}</small>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  )
}

/** ajuste de quantidade em passos, no lugar do campo numérico do navegador */
export function Stepper({
  label,
  value,
  onChange,
  format,
  min,
  max,
  step,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  format: (value: number) => string
  min: number
  max: number
  step: number
}) {
  const set = (v: number) => onChange(Math.min(Math.max(v, min), max))
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="stepper" role="group" aria-label={label}>
        <button type="button" aria-label={`Diminuir ${label.toLowerCase()}`} disabled={value <= min} onClick={() => set(value - step)}>
          <Minus size={16} aria-hidden="true" />
        </button>
        <output>{format(value)}</output>
        <button type="button" aria-label={`Aumentar ${label.toLowerCase()}`} disabled={value >= max} onClick={() => set(value + step)}>
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/** valor em reais digitado como texto ("90", "90,50") */
export function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="input">
        <span className="input__prefix">R$</span>
        <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d,]/g, ''))} inputMode="decimal" placeholder="0,00" maxLength={9} />
      </span>
    </label>
  )
}

export const parseMoney = (v: string) => {
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** interruptor liga/desliga */
export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="switch">
      <span className="switch__text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden="true" />
    </label>
  )
}

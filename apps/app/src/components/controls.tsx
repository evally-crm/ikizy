import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { Check, ChevronDown, Minus, Plus } from 'lucide-react'
import { formatPhone } from '../lib/format'

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
  pill,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  /** o rótulo continua para leitores de tela, mas não aparece */
  hideLabel?: boolean
  /** filtro compacto em pílula, ao lado de um título (o menu abre a partir dele, alinhado à direita) */
  pill?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false), open)

  // ao abrir, a lista já mostra o que está escolhido (numa lista de horários, não começa sempre no primeiro)
  useEffect(() => {
    if (open) ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open])

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
    <div className={pill ? 'pick--pill' : 'field'} ref={ref}>
      <span className={`field__label ${hideLabel || pill ? 'sr-only' : ''}`}>{label}</span>
      <div className="pick">
        <button
          type="button"
          className={pill ? 'pick__btn pick__btn--pill' : 'input pick__btn'}
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
                  {c.phone && <small>{formatPhone(c.phone)}</small>}
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

/** o teto do trilho de preço: pelo menos R$ 300 e sempre com folga acima do valor (arredondado a 100) */
const priceCeiling = (v: number) => Math.max(300, Math.ceil((v * 1.5) / 100) * 100)

/**
 * preço com − / + e um trilho que se arrasta: o bloco branco segue o dedo 1:1 a partir de onde foi pego
 * (sem pular para o ponto tocado), e − / + andam de 5 em 5. Teclado: setas (5), Page Up/Down (50).
 * "Digitar valor" troca para o campo de texto, para centavos ou valores fora do trilho.
 */
export function PriceField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  // o teto fica fixo (senão o trilho mudaria de escala debaixo do dedo)
  const [ceiling, setCeiling] = useState(() => priceCeiling(value))
  const drag = useRef<{ x: number; start: number; width: number } | null>(null)
  const step = 5
  const set = (v: number) => onChange(Math.max(0, Math.round(v * 100) / 100))
  const snap = (v: number) => Math.min(Math.max(Math.round(v / step) * step, 0), ceiling)

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, start: value, width: e.currentTarget.getBoundingClientRect().width }
    setDragging(true)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    set(snap(d.start + ((e.clientX - d.x) / d.width) * ceiling))
  }
  // o teto não muda ao soltar (o bloco daria um salto); só cresce quando o valor passa dele
  const onPointerUp = () => {
    drag.current = null
    setDragging(false)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : e.key === 'PageUp' ? 50 : e.key === 'PageDown' ? -50 : 0
    if (!by) return
    e.preventDefault()
    const next = Math.max(0, value + by)
    set(next)
    if (next > ceiling) setCeiling(priceCeiling(next))
  }
  const bump = (by: number) => {
    const next = Math.max(0, snap(value) === value ? value + by : by > 0 ? Math.ceil(value / step) * step : Math.floor(value / step) * step)
    set(next)
    if (next > ceiling) setCeiling(priceCeiling(next))
  }

  if (typing) {
    return (
      <div className="field price">
        <MoneyField label={label} value={text} onChange={setText} />
        <button
          type="button"
          className="price__type"
          onClick={() => {
            const v = parseMoney(text)
            set(v)
            if (v > ceiling) setCeiling(priceCeiling(v))
            setTyping(false)
          }}
        >
          Usar o trilho
        </button>
      </div>
    )
  }

  const shown = Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
  return (
    <div className="field price">
      <span className="field__label">{label}</span>
      <div
        className={`price__track ${dragging ? 'is-dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={ceiling}
        aria-valuenow={value}
        aria-valuetext={`R$ ${shown}`}
        style={{ '--pct': Math.min(value / ceiling, 1) } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <span className="price__fill" aria-hidden="true" />
        <button type="button" className="price__btn" tabIndex={-1} aria-label="Diminuir 5 reais" disabled={value <= 0} onClick={() => bump(-step)}>
          <Minus size={20} aria-hidden="true" />
        </button>
        <output className="price__value">
          <small>R$</small>
          {shown}
        </output>
        <button type="button" className="price__btn" tabIndex={-1} aria-label="Aumentar 5 reais" onClick={() => bump(step)}>
          <Plus size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="price__scale" aria-hidden="true">
        <span>R$ 0</span>
        <span>R$ {ceiling}</span>
      </div>
      <button
        type="button"
        className="price__type"
        onClick={() => {
          setText(value ? String(value).replace('.', ',') : '')
          setTyping(true)
        }}
      >
        Digitar valor
      </button>
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

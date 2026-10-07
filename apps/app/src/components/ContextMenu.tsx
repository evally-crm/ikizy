import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, type LucideIcon } from 'lucide-react'

export type MenuEntry =
  | { kind: 'sep' }
  | {
      kind: 'item'
      label: string
      icon?: LucideIcon
      /** tecla de atalho mostrada à direita e acionada com o menu aberto */
      hint?: string
      danger?: boolean
      checked?: boolean
      disabled?: boolean
      onSelect?: () => void
      children?: MenuEntry[]
    }

type Item = Extract<MenuEntry, { kind: 'item' }>

const isItem = (e: MenuEntry): e is Item => e.kind === 'item'

function MenuList({
  entries,
  onClose,
  onBack,
  flip,
}: {
  entries: MenuEntry[]
  onClose: () => void
  /** só nos submenus: volta para a lista de cima */
  onBack?: () => void
  flip: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const selectable = entries.map((e, i) => (isItem(e) && !e.disabled ? i : -1)).filter((i) => i >= 0)
  const [active, setActive] = useState<number>(selectable[0] ?? -1)
  const [openSub, setOpenSub] = useState<number>(-1)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const run = (item: Item) => {
    item.onSelect?.()
    onClose()
  }

  const move = (dir: 1 | -1) => {
    const at = selectable.indexOf(active)
    const next = selectable[(at + dir + selectable.length) % selectable.length]
    setActive(next)
    setOpenSub(-1)
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (onBack) onBack()
      else onClose()
      return
    }
    if (e.key === 'ArrowDown') return e.preventDefault(), move(1)
    if (e.key === 'ArrowUp') return e.preventDefault(), move(-1)
    if (e.key === 'ArrowLeft' && onBack) return e.preventDefault(), e.stopPropagation(), onBack()
    const current = entries[active]
    if ((e.key === 'ArrowRight' || e.key === 'Enter') && current && isItem(current)) {
      e.preventDefault()
      e.stopPropagation()
      if (current.children) setOpenSub(active)
      else if (e.key === 'Enter') run(current)
      return
    }
    const key = e.key === 'Backspace' || e.key === 'Delete' ? '⌫' : e.key.toUpperCase()
    const hit = entries.find((x) => isItem(x) && !x.disabled && x.hint === key)
    if (hit && isItem(hit)) {
      e.preventDefault()
      e.stopPropagation()
      if (hit.children) setOpenSub(entries.indexOf(hit))
      else run(hit)
    }
  }

  return (
    <div ref={ref} className={`cmenu ${onBack ? 'cmenu--sub' : ''} ${flip ? 'cmenu--flip' : ''}`} role="menu" tabIndex={-1} onKeyDown={onKey}>
      {entries.map((e, i) => {
        if (!isItem(e)) return <div key={i} className="cmenu__sep" role="separator" />
        const Icon = e.icon
        return (
          <div key={i} className="cmenu__row">
            <button
              type="button"
              role="menuitem"
              disabled={e.disabled}
              className={`cmenu__item ${i === active ? 'is-active' : ''} ${e.danger ? 'is-danger' : ''}`}
              aria-haspopup={e.children ? 'menu' : undefined}
              onMouseEnter={() => {
                if (e.disabled) return
                setActive(i)
                setOpenSub(e.children ? i : -1)
              }}
              onClick={() => (e.children ? setOpenSub(i) : run(e))}
            >
              <span className="cmenu__icon">{Icon ? <Icon size={15} aria-hidden="true" /> : null}</span>
              <span className="cmenu__label">{e.label}</span>
              {e.checked && <Check size={14} aria-hidden="true" />}
              {e.hint && <kbd className="cmenu__hint">{e.hint}</kbd>}
              {e.children && <ChevronRight size={14} aria-hidden="true" />}
            </button>
            {e.children && openSub === i && (
              <MenuList
                entries={e.children}
                onClose={onClose}
                flip={flip}
                onBack={() => {
                  setOpenSub(-1)
                  ref.current?.focus()
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** menu de botão direito, no estilo do Linear: ícones, atalhos, submenus e teclado */
export function ContextMenu({ x, y, entries, onClose }: { x: number; y: number; entries: MenuEntry[]; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y, flip: false })

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const left = Math.max(8, Math.min(x, window.innerWidth - width - 8))
    const top = Math.max(8, Math.min(y, window.innerHeight - height - 8))
    setPos({ left, top, flip: left + width + 220 > window.innerWidth })
  }, [x, y])

  useEffect(() => {
    const away = (e: Event) => !box.current?.contains(e.target as Node) && onClose()
    document.addEventListener('mousedown', away)
    document.addEventListener('contextmenu', away)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('contextmenu', away)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return createPortal(
    <div ref={box} className="cmenu-layer" style={{ left: pos.left, top: pos.top }} onContextMenu={(e) => e.preventDefault()}>
      <MenuList entries={entries} onClose={onClose} flip={pos.flip} />
    </div>,
    document.body,
  )
}

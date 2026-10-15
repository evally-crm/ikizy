import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import './Tabs.css'

export interface TabItem<T extends string> {
  id: T
  label: ReactNode
  /** número ou ícone pequeno ao lado do rótulo */
  badge?: ReactNode
  /** nome para leitores de tela quando o rótulo é só um ícone */
  ariaLabel?: string
}

/** última posição da pílula de cada seletor (pelo nome): quando a tela troca e o seletor nasce de novo, ele desliza dali */
const LAST = new Map<string, { x: number; w: number }>()

/** abas em pílula: uma opção ativa por vez (período, mês, seção); a pílula branca desliza até a escolhida */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  fill = false,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  /** nome da lista de abas para leitores de tela */
  label: string
  /** as abas dividem a largura toda (celular) */
  fill?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  // a primeira medida aparece sem animar (senão a pílula "voa" do canto ao abrir a tela)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const measure = () => {
      const active = box.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!active) return setPill(null)
      const next = { x: active.offsetLeft, w: active.offsetWidth }
      LAST.set(label, next)
      setPill(next)
    }
    // a tela trocou junto com a aba (ex.: Hoje → Mês) e o seletor nasceu de novo: parte de onde a pílula estava
    const prev = LAST.get(label)
    let raf = 0
    if (!ready && prev) {
      setPill(prev)
      raf = requestAnimationFrame(() => {
        setReady(true)
        raf = requestAnimationFrame(measure)
      })
    } else {
      measure()
      raf = requestAnimationFrame(() => setReady(true))
    }
    const ro = new ResizeObserver(() => ready && measure())
    ro.observe(box)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [value, items.length, label, ready])

  return (
    <div
      ref={ref}
      className={`tabs ${fill ? 'tabs--fill' : ''} ${pill ? 'has-pill' : ''} ${ready ? 'is-ready' : ''}`.replace(/\s+/g, ' ').trim()}
      role="tablist"
      aria-label={label}
      style={pill ? ({ '--pill-x': `${pill.x}px`, '--pill-w': `${pill.w}px` } as CSSProperties) : undefined}
    >
      <span className="tabs__pill" aria-hidden="true" />
      {items.map((item) => (
        <button key={item.id} type="button" role="tab" className="tabs__item" aria-selected={item.id === value} aria-label={item.ariaLabel} title={item.ariaLabel} onClick={() => onChange(item.id)}>
          {item.label}
          {item.badge !== undefined && item.badge !== null && <span className="tabs__badge">{item.badge}</span>}
        </button>
      ))}
    </div>
  )
}

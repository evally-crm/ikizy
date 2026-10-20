import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

/** quanto o dedo anda até deixar de ser toque e virar arrasto */
const DRAG_PX = 6

/**
 * lente de vidro de um seletor (como a tab bar do iOS 26): parada, marca a opção escolhida; com o dedo em cima,
 * cresce, vira vidro e segue o toque pela faixa; ao soltar depois de arrastar, escolhe a opção que ficou embaixo.
 * Num toque simples quem escolhe é o próprio botão/link, então o clique segue normal.
 */
export function useLensDrag<E extends HTMLElement>({
  itemSelector,
  selected,
  onPick,
  deps = [],
}: {
  /** seletor CSS das opções dentro da faixa */
  itemSelector: string
  /** índice da opção escolhida agora (-1 se nenhuma) */
  selected: number
  /** soltou o arrasto em cima de uma opção */
  onPick: (index: number) => void
  /** o que, ao mudar, pede para medir as opções de novo */
  deps?: unknown[]
}) {
  const ref = useRef<E>(null)
  const [rects, setRects] = useState<{ x: number; w: number }[]>([])
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const measure = () => {
      const next = [...box.querySelectorAll<HTMLElement>(itemSelector)].map((el) => ({ x: el.offsetLeft, w: el.offsetWidth }))
      setRects((prev) => (prev.length === next.length && prev.every((r, i) => r.x === next[i].x && r.w === next[i].w) ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  const [drag, setDrag] = useState<{ x: number; over: number } | null>(null)
  const start = useRef<{ x: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  const itemAt = (x: number) => {
    let best = 0
    rects.forEach((r, i) => {
      if (Math.abs(x - (r.x + r.w / 2)) < Math.abs(x - (rects[best].x + rects[best].w / 2))) best = i
    })
    return best
  }
  // posição do dedo dentro da faixa (a faixa pode estar rolada, como as abas no celular)
  const localX = (e: ReactPointerEvent) => {
    const box = ref.current
    return box ? e.clientX - box.getBoundingClientRect().left + box.scrollLeft : 0
  }

  const finish = (cancel: boolean) => {
    if (!start.current) return
    const { moved } = start.current
    start.current = null
    const over = drag?.over ?? selected
    setDrag(null)
    if (cancel || !moved) return
    suppressClick.current = true
    if (over !== selected) onPick(over)
  }

  const over = drag ? drag.over : selected
  const rest = rects[over]
  const w = rest?.w ?? 0
  const half = w / 2
  const first = rects[0]
  const last = rects[rects.length - 1]
  const center = drag && first && last ? Math.min(Math.max(drag.x, first.x + half), last.x + last.w - half) : (rest?.x ?? 0) + half

  return {
    ref,
    /** opção sob a lente (a escolhida, ou a que está embaixo do dedo) */
    over,
    pressing: drag !== null,
    ready: rects.length > 0 && selected >= 0,
    lensStyle: { '--lens-x': `${center - half}px`, '--lens-w': `${w}px` } as CSSProperties,
    handlers: {
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.button !== 0 || !rects.length) return
        // o arrasto anterior pode ter terminado fora da faixa, sem clique para engolir
        suppressClick.current = false
        const x = localX(e)
        start.current = { x, moved: false }
        setDrag({ x, over: itemAt(x) })
      },
      onPointerMove: (e: ReactPointerEvent) => {
        if (!start.current) return
        const x = localX(e)
        if (!start.current.moved && Math.abs(x - start.current.x) > DRAG_PX) {
          start.current.moved = true
          ref.current?.setPointerCapture(e.pointerId)
        }
        setDrag({ x, over: itemAt(x) })
      },
      onPointerUp: () => finish(false),
      onPointerCancel: () => finish(true),
      onClickCapture: (e: ReactMouseEvent) => {
        if (!suppressClick.current) return
        suppressClick.current = false
        e.preventDefault()
        e.stopPropagation()
      },
    },
  }
}

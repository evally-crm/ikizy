import { useEffect, useRef, useState, type PointerEvent } from 'react'

const W = 560
const H = 180

/** campo para assinar com o dedo ou o mouse; devolve PNG em data URL (ou null quando vazio) */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0e0d0d'
  }, [])

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }

  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + 0.1, p.y + 0.1)
    ctx.stroke()
  }

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    const p = point(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    setEmpty(false)
    onChange(canvas.current?.toDataURL('image/png') ?? null)
  }

  const clear = () => {
    const c = canvas.current
    c?.getContext('2d')?.clearRect(0, 0, W, H)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className="sigpad">
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="sigpad__canvas"
        aria-label="Assine aqui com o dedo ou o mouse"
        role="img"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className="sigpad__foot">
        <span>{empty ? 'Assine na linha acima' : 'Assinatura da cliente'}</span>
        {!empty && (
          <button type="button" className="textlink" onClick={clear}>
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { FACE } from './brailleFace'

const INK = '27, 27, 29'
const FRAME_MS = 1000 / 30
const REVEAL_S = 1.6

// bits de cada caractere Braille (U+2800 + máscara) → posição do ponto na célula 2 × 4
const BITS: [number, number, number][] = [
  [0x01, 0, 0],
  [0x02, 0, 1],
  [0x04, 0, 2],
  [0x40, 0, 3],
  [0x08, 1, 0],
  [0x10, 1, 1],
  [0x20, 1, 2],
  [0x80, 1, 3],
]

const COLS = FACE[0].length * 2
const ROWS = FACE.length * 4

/** grade de pontos: 1 = ponto aceso do rosto, 0 = posição vazia da célula */
const DOTS: Uint8Array = (() => {
  const grid = new Uint8Array(COLS * ROWS)
  FACE.forEach((line, cy) => {
    Array.from(line).forEach((ch, cx) => {
      const mask = ch.codePointAt(0)! - 0x2800
      for (const [bit, dx, dy] of BITS) {
        if (mask & bit) grid[(cy * 4 + dy) * COLS + cx * 2 + dx] = 1
      }
    })
  })
  return grid
})()

/** ruído fixo por ponto, para a revelação não andar em linha reta */
const JITTER = Float32Array.from({ length: COLS * ROWS }, (_, i) => {
  const s = Math.sin(i * 12.9898) * 43758.5453
  return s - Math.floor(s)
})

/** rosto em Braille: os pontos surgem de cima para baixo e depois "respiram" com uma onda lenta */
function draw(canvas: HTMLCanvasElement, t: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const { width, height } = canvas.getBoundingClientRect()
  const w = Math.round(width * dpr)
  const h = Math.round(height * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  // o rosto ocupa a altura disponível, centralizado; no celular cobre a tela inteira atrás do formulário
  const step = Math.min((height * 0.86) / ROWS, (width * 0.92) / COLS)
  const ox = (width - COLS * step) / 2 + step / 2
  const oy = (height - ROWS * step) / 2 + step / 2
  const r = step * 0.36

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x
      const lit = DOTS[i] === 1
      const reveal = Math.min(1, Math.max(0, (t / REVEAL_S - (y / ROWS) * 0.7 - JITTER[i] * 0.3) * 4))
      if (reveal <= 0) continue
      const wave = Math.sin(x * 0.11 + y * 0.07 - t * 1.4) * 0.5 + 0.5
      const px = ox + x * step
      const py = oy + y * step
      ctx.beginPath()
      if (lit) {
        ctx.fillStyle = `rgba(${INK}, ${reveal * (0.78 + wave * 0.22)})`
        ctx.arc(px, py, r * (0.85 + wave * 0.2), 0, Math.PI * 2)
      } else {
        // posições vazias da célula Braille ficam como relevo apagado, sumindo perto da borda da grade
        const edge = Math.min(1, (1 - Math.max(Math.abs(x / COLS - 0.5), Math.abs(y / ROWS - 0.5)) * 2) * 5)
        ctx.fillStyle = `rgba(${INK}, ${reveal * edge * (0.05 + wave * 0.04)})`
        ctx.arc(px, py, r * 0.55, 0, Math.PI * 2)
      }
      ctx.fill()
    }
  }
}

export function BrailleFace() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let last = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      if (now - last >= FRAME_MS) {
        last = now
        draw(canvas, (now - start) / 1000)
      }
      frame = requestAnimationFrame(tick)
    }
    // sem movimento: rosto já revelado e parado
    if (still) draw(canvas, REVEAL_S * 2)
    else frame = requestAnimationFrame(tick)
    const observer = new ResizeObserver(() => still && draw(canvas, REVEAL_S * 2))
    observer.observe(canvas)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return <canvas ref={ref} className="auth__art" aria-hidden="true" />
}

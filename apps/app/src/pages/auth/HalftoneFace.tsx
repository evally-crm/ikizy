import { useEffect, useRef } from 'react'
import { FACE } from './brailleFace'

const STEP = 9
const FRAME_MS = 1000 / 30
const BLUR = 3

/** ruído fixo por ponto: espalha os pontos nas áreas claras, como meio-tom impresso */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

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

/** caixa de desfoque numa direção (passo 1 = horizontal, COLS = vertical) */
function boxBlur(src: Float32Array, step: 1 | typeof COLS) {
  const out = new Float32Array(src.length)
  const len = step === 1 ? COLS : ROWS
  const lines = step === 1 ? ROWS : COLS
  for (let l = 0; l < lines; l++) {
    const base = step === 1 ? l * COLS : l
    for (let i = 0; i < len; i++) {
      let sum = 0
      let n = 0
      for (let k = Math.max(0, i - BLUR); k <= Math.min(len - 1, i + BLUR); k++) {
        sum += src[base + k * step]
        n++
      }
      out[base + i * step] = sum / n
    }
  }
  return out
}

/** tom do rosto (0 claro .. 1 escuro): a arte em Braille vira manchas suaves depois de desfocada duas vezes */
const TONE: Float32Array = (() => {
  let grid = new Float32Array(COLS * ROWS)
  FACE.forEach((line, cy) => {
    Array.from(line).forEach((ch, cx) => {
      const mask = ch.codePointAt(0)! - 0x2800
      for (const [bit, dx, dy] of BITS) if (mask & bit) grid[(cy * 4 + dy) * COLS + cx * 2 + dx] = 1
    })
  })
  for (let pass = 0; pass < 2; pass++) grid = boxBlur(boxBlur(grid, 1), COLS)
  let max = 0
  for (const v of grid) max = Math.max(max, v)
  return grid.map((v) => Math.min(1, v / (max * 0.75)))
})()

/** tom com interpolação, em coordenadas da arte (0..COLS, 0..ROWS) */
function sample(px: number, py: number) {
  if (px < 0 || py < 0 || px >= COLS - 1 || py >= ROWS - 1) return 0
  const x0 = Math.floor(px)
  const y0 = Math.floor(py)
  const fx = px - x0
  const fy = py - y0
  const i = y0 * COLS + x0
  const top = TONE[i] * (1 - fx) + TONE[i + 1] * fx
  const bottom = TONE[i + COLS] * (1 - fx) + TONE[i + COLS + 1] * fx
  return top * (1 - fy) + bottom * fy
}

/** rosto em meio-tom: os pontos crescem e encolhem em ondas que vão e voltam, sem contorno definido */
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
  ctx.fillStyle = getComputedStyle(canvas).color

  // a arte ocupa a altura toda (um pouco cortada) e balança devagar para os lados
  const unit = Math.max((height * 1.08) / ROWS, (width * 0.9) / COLS)
  const ox = (width - COLS * unit) / 2 + Math.sin(t * 0.35) * unit * 1.5
  const oy = (height - ROWS * unit) / 2

  for (let row = 0, y = STEP / 2; y < height; row++, y += STEP) {
    // linhas alternadas deslocadas: grade em diagonal, como no meio-tom impresso
    for (let x = STEP / 2 + (row % 2) * (STEP / 2); x < width; x += STEP) {
      // pequena ondulação nas coordenadas: o rosto respira e nunca fica nítido
      const px = (x - ox) / unit + Math.sin(y * 0.02 + t * 0.9) * 0.8
      const py = (y - oy) / unit + Math.sin(x * 0.017 - t * 0.7) * 0.8
      let d = sample(px, py)
      if (d <= 0.04) continue
      const wave =
        Math.sin(x * 0.012 + Math.sin(y * 0.009 + t * 0.6) * 2.4 + t) +
        Math.sin(y * 0.014 - x * 0.007 + 1.7 - t * 0.8) * 0.8
      d *= 0.75 + wave * 0.15
      if (hash(x, y) > d * 2.2) continue
      const size = Math.pow(Math.max(0, d), 0.9) * STEP * 0.58
      if (size < 0.5) continue
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function HalftoneFace() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now
        draw(canvas, now / 1000)
      }
      frame = requestAnimationFrame(tick)
    }
    if (still) draw(canvas, 0)
    else frame = requestAnimationFrame(tick)
    const observer = new ResizeObserver(() => still && draw(canvas, 0))
    observer.observe(canvas)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return <canvas ref={ref} className="auth__art" aria-hidden="true" />
}

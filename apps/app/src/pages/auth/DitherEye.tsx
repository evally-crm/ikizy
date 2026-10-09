import { useEffect, useRef } from 'react'

const INK = '27, 27, 29'
const FRAME_MS = 1000 / 30
/** largura da coluna (uma linha fina por coluna) e altura do bloco */
const COL = 6
const ROW = 4
const BLINK_EVERY = 6.5

/** limiar de cada bloco com um pouco de ruído fixo: as bordas saem serrilhadas, em pedaços (aspecto lo-fi) */
const threshold = (c: number, r: number) => {
  const s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453
  return 0.4 + (s - Math.floor(s)) * 0.2
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/** abertura da pálpebra: piscada rápida a cada BLINK_EVERY segundos */
function openness(t: number) {
  const p = (t % BLINK_EVERY) / BLINK_EVERY
  const d = Math.abs(p - 0.97) * BLINK_EVERY // segundos até o meio da piscada
  return 0.06 + 0.94 * smooth(0, 0.14, d)
}

/** escuridão (0..1) do olho no ponto (u, v), com o centro do olho em 0,0 */
function shade(u: number, v: number, t: number, open: number, gx: number, gy: number) {
  // deformação líquida: o desenho escorre devagar e fica menos definido
  const wu = u + Math.sin(v * 5 + t * 0.9) * 0.05 + Math.sin(v * 13 - t * 1.7) * 0.012
  const wv = v + Math.sin(wu * 4 - t * 0.7) * 0.05

  const A = 1.25 // meia largura do olho: maior que o painel, então ele vaza pelas bordas
  const k = Math.max(0, 1 - (wu / A) ** 2)
  const top = -0.62 * k * open
  const bottom = 0.42 * k * Math.max(open, 0.3)
  const waves = Math.sin(wu * 6 + Math.sin(wv * 4 + t * 0.6) * 2 + t) * 0.5 + 0.5

  // fora do olho: pele com ondas, prega acima da pálpebra e cílios
  if (wv < top || wv > bottom || k === 0) {
    let d = smooth(0.9, 1, waves) * 0.75
    const lid = top - wv
    if (wv < top) {
      d += (1 - smooth(0, 0.07, lid)) * 0.85 // borda grossa da pálpebra
      d += (1 - smooth(0, 0.05, Math.abs(lid - 0.24 * k - 0.06))) * 0.45 // prega
      const lash = Math.sin(wu * 34 + lid * 26) > 0.55 && lid < 0.2 * k ? 0.7 : 0
      d += lash * (1 - lid / (0.2 * k + 0.001))
    } else {
      d += (1 - smooth(0, 0.04, wv - bottom)) * 0.6
    }
    return Math.min(1, d)
  }

  // dentro: branco do olho levemente sombreado nos cantos e sob a pálpebra
  let d = 0.04 + (1 - k) * 0.35 + (1 - smooth(0, 0.18, wv - top)) * 0.3
  const du = wu - gx
  const dv = wv - gy
  const r = Math.hypot(du, dv)
  const R = 0.44
  if (r < R) {
    const ang = Math.atan2(dv, du)
    const fibers = Math.sin(ang * 26 + r * 9 + Math.sin(ang * 5 + t) * 0.8) * 0.5 + 0.5
    d = 0.4 + fibers * 0.3 * (r / R) + smooth(0.78 * R, R, r) * 0.5
    const pupil = 0.15 + Math.sin(t * 0.5) * 0.02
    if (r < pupil) d = 1
    if (Math.hypot(du + 0.12, dv + 0.13) < 0.065) d = 0 // brilho
  }
  return Math.min(1, d)
}

/** olho em linhas verticais e blocos (tipo dithering), ocupando o painel e se mexendo devagar */
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
  ctx.fillStyle = `rgb(${INK})`

  const scale = Math.min(width, height * 1.1) / 2
  const cx = width / 2
  const cy = height * 0.48
  const open = openness(t)
  // o olhar passeia devagar
  const gx = Math.sin(t * 0.27) * 0.22 + Math.sin(t * 0.71) * 0.06
  const gy = Math.sin(t * 0.38) * 0.05 - 0.02

  const cols = Math.ceil(width / COL)
  const rows = Math.ceil(height / ROW)
  for (let c = 0; c < cols; c++) {
    const x = c * COL
    ctx.fillRect(x, 0, 0.8, height) // linha fina de cada coluna
    const u = (x + COL / 2 - cx) / scale
    for (let r = 0; r < rows; r++) {
      const y = r * ROW
      const d = shade(u, (y + ROW / 2 - cy) / scale, t, open, gx, gy)
      if (d > threshold(c, r)) ctx.fillRect(x, y, COL, ROW)
    }
  }
}

export function DitherEye() {
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

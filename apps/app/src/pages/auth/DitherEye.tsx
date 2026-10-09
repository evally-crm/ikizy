import { useEffect, useRef } from 'react'

const FRAME_MS = 1000 / 30
/** tamanho da célula: cada uma vira um símbolo (ponto, x, quadrado, barras) conforme o tom */
const CELL = 9
const BLINK_EVERY = 7

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
const bell = (x: number, w: number) => Math.exp(-((x / w) ** 2))

/** ruído fixo por célula: quebra as faixas de tom e dá o aspecto lo-fi */
const hash = (c: number, r: number) => {
  const s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/** abertura da pálpebra: piscada lenta a cada BLINK_EVERY segundos */
function openness(t: number) {
  const d = Math.abs((t % BLINK_EVERY) - BLINK_EVERY * 0.96)
  return 0.08 + 0.92 * smooth(0, 0.28, d)
}

/** brilho (0 escuro .. 1 claro) de um olho em close, com tons suaves como numa foto */
function brightness(u: number, v: number, t: number, open: number, gx: number, gy: number) {
  // deformação lenta: o desenho respira e nunca fica nítido
  const wu = u + Math.sin(v * 4 + t * 0.7) * 0.03
  const wv = v + Math.sin(u * 3 - t * 0.5) * 0.03

  const A = 1.05
  const k = Math.max(0, 1 - (wu / A) ** 2)
  const top = -0.5 * Math.pow(k, 0.8) * open
  const bottom = 0.32 * Math.pow(k, 0.9)
  const skin = 0.5 + Math.sin(wu * 3 + wv * 2 + t * 0.3) * 0.06

  if (wv < top || wv > bottom || k === 0) {
    let b = skin
    b -= bell(wv + 0.9 - 0.18 * wu * wu, 0.13) * 0.4 // sobrancelha
    b -= bell(wv - (top - 0.2 * k - 0.05), 0.07) * 0.3 // prega da pálpebra
    if (wv < top) {
      const lid = top - wv
      b -= bell(lid, 0.035) * 0.65 // linha dos cílios
      if (lid < 0.16 * k && Math.sin(wu * 38 + lid * 30) > 0.35) b -= 0.45 * (1 - lid / (0.16 * k + 0.001))
    } else {
      b -= bell(wv - bottom, 0.025) * 0.4
      b -= bell(wv - bottom - 0.16, 0.12) * 0.15 // olheira
    }
    return Math.min(1, Math.max(0, b))
  }

  // dentro do olho: branco sombreado nos cantos e sob a pálpebra de cima
  let b = 0.86 - (1 - k) * 0.45 - Math.exp(-(wv - top) / 0.07) * 0.55
  const du = wu - gx
  const dv = wv - gy
  const r = Math.hypot(du, dv)
  const R = 0.34
  if (r < R) {
    const ang = Math.atan2(dv, du)
    const fibers = Math.sin(ang * 22 + r * 8 + Math.sin(ang * 4 + t * 0.6)) * 0.5 + 0.5
    b = 0.3 + fibers * 0.18 * (r / R) - smooth(0.75 * R, R, r) * 0.22
    b -= Math.exp(-(wv - top) / 0.07) * 0.2
    const pupil = 0.13 + Math.sin(t * 0.4) * 0.015
    b *= smooth(pupil - 0.01, pupil + 0.03, r)
    b = Math.max(b, bell(Math.hypot(du + 0.1, dv + 0.11), 0.045)) // brilho
  }
  return Math.min(1, Math.max(0, b))
}

/** símbolo da célula conforme a densidade: nada · ponto · x · quadrado vazado · quadrado cheio · barras */
function glyph(ctx: CanvasRenderingContext2D, x: number, y: number, d: number) {
  const m = CELL / 2
  if (d < 0.14) return
  if (d < 0.3) return ctx.fillRect(x + m - 0.75, y + m - 0.75, 1.5, 1.5)
  if (d < 0.46) {
    ctx.beginPath()
    ctx.moveTo(x + m - 2, y + m - 2)
    ctx.lineTo(x + m + 2, y + m + 2)
    ctx.moveTo(x + m + 2, y + m - 2)
    ctx.lineTo(x + m - 2, y + m + 2)
    return ctx.stroke()
  }
  if (d < 0.6) return ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3)
  if (d < 0.74) return ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2)
  if (d < 0.88) {
    ctx.fillRect(x + 1, y, 1.5, CELL)
    return ctx.fillRect(x + CELL - 3, y, 1.5, CELL)
  }
  ctx.fillRect(x, y, 1.5, CELL)
  ctx.fillRect(x + m - 0.75, y, 1.5, CELL)
  ctx.fillRect(x + CELL - 2, y, 1.5, CELL)
}

/** olho em close feito de símbolos, ocupando o painel e se mexendo devagar (olhar, piscada, respiração) */
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

  // a cor dos símbolos vem do CSS; símbolos claros (fundo escuro) desenham a luz, escuros desenham a sombra
  const color = getComputedStyle(canvas).color
  const [cr, cg, cb] = (color.match(/\d+/g) ?? ['0', '0', '0']).map(Number)
  const lightInk = cr + cg + cb > 382
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 1.2

  const scale = Math.min(width, height * 1.2) / 2
  const cx = width / 2
  const cy = height * 0.5
  const open = openness(t)
  const gx = Math.sin(t * 0.23) * 0.16 + Math.sin(t * 0.61) * 0.05
  const gy = Math.sin(t * 0.31) * 0.04

  const cols = Math.ceil(width / CELL)
  const rows = Math.ceil(height / CELL)
  for (let c = 0; c < cols; c++) {
    const u = ((c + 0.5) * CELL - cx) / scale
    for (let r = 0; r < rows; r++) {
      const b = brightness(u, ((r + 0.5) * CELL - cy) / scale, t, open, gx, gy)
      const d = (lightInk ? b : 1 - b) + (hash(c, r) - 0.5) * 0.1
      glyph(ctx, c * CELL, r * CELL, d)
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

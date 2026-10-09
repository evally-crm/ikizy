import { useEffect, useRef } from 'react'
import { TONE_B64, TONE_H, TONE_W } from './faceTone'

const CELL = 7
const FRAME_MS = 1000 / 30

/** tom do rosto (0 claro .. 1 escuro), decodificado uma vez */
const TONE: Float32Array = (() => {
  const raw = atob(TONE_B64)
  const out = new Float32Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i) / 255
  return out
})()

/** tom com interpolação, em coordenadas do mapa (0..TONE_W, 0..TONE_H); fora do mapa é branco */
function sample(px: number, py: number) {
  const x = Math.min(TONE_W - 1.001, Math.max(0, px))
  const y = Math.min(TONE_H - 1.001, Math.max(0, py))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const i = y0 * TONE_W + x0
  const top = TONE[i] * (1 - fx) + TONE[i + 1] * fx
  const bottom = TONE[i + TONE_W] * (1 - fx) + TONE[i + TONE_W + 1] * fx
  return top * (1 - fy) + bottom * fy
}

/** ruído fixo por célula: mistura os símbolos vizinhos, como na impressão de referência */
const hash = (c: number, r: number) => {
  const s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/** símbolo da célula conforme o tom: nada · ponto · + · x · quadradinho · quadrado */
function glyph(ctx: CanvasRenderingContext2D, x: number, y: number, d: number, mix: number) {
  const m = CELL / 2
  if (d < 0.1) return
  // nas áreas escuras, parte das células vira x em vez de quadrado, como na referência
  if (d >= 0.56 && mix < 0.3) d = 0.5
  if (d < 0.24) return ctx.fillRect(x + m - 0.8, y + m - 0.8, 1.6, 1.6)
  ctx.beginPath()
  if (d < 0.4) {
    ctx.moveTo(x + m, y + m - 2.2)
    ctx.lineTo(x + m, y + m + 2.2)
    ctx.moveTo(x + m - 2.2, y + m)
    ctx.lineTo(x + m + 2.2, y + m)
    return ctx.stroke()
  }
  if (d < 0.56) {
    ctx.moveTo(x + m - 2, y + m - 2)
    ctx.lineTo(x + m + 2, y + m + 2)
    ctx.moveTo(x + m + 2, y + m - 2)
    ctx.lineTo(x + m - 2, y + m + 2)
    return ctx.stroke()
  }
  if (d < 0.72) return ctx.fillRect(x + m - 2, y + m - 2, 4, 4)
  ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2)
}

/** rosto de perfil em símbolos: respira, balança de leve e as ondas fazem os símbolos irem e voltarem */
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
  const color = getComputedStyle(canvas).color
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5

  // o mapa cobre o painel inteiro (como object-fit: cover), encostado à direita
  const unit = Math.max(width / TONE_W, height / TONE_H)
  const ox = width - TONE_W * unit
  const oy = (height - TONE_H * unit) / 2
  // movimento do rosto: respiração (escala), leve inclinação e deslocamento para os lados
  const breathe = 1 + Math.sin(t * 0.8) * 0.012
  const tilt = Math.sin(t * 0.33) * 0.025
  const shift = Math.sin(t * 0.27) * 1.2
  const pcx = TONE_W * 0.6
  const pcy = TONE_H * 0.55
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)

  const cols = Math.ceil(width / CELL)
  const rows = Math.ceil(height / CELL)
  for (let c = 0; c < cols; c++) {
    const x = c * CELL + CELL / 2
    for (let r = 0; r < rows; r++) {
      const y = r * CELL + CELL / 2
      // posição no mapa, girada e escalada em torno do centro do rosto, com ondulação líquida
      const mx = (x - ox) / unit - pcx
      const my = (y - oy) / unit - pcy
      const px = (mx * cos - my * sin) / breathe + pcx + shift + Math.sin(my * 0.15 + t * 0.9) * 0.6
      const py = (mx * sin + my * cos) / breathe + pcy + Math.sin(mx * 0.12 - t * 0.7) * 0.6
      const wave =
        Math.sin(x * 0.012 + Math.sin(y * 0.009 + t * 0.6) * 2.4 + t) +
        Math.sin(y * 0.014 - x * 0.007 + 1.7 - t * 0.8) * 0.8
      const d = sample(px, py) * (0.95 + wave * 0.08) + (hash(c, r) - 0.5) * 0.2
      glyph(ctx, c * CELL, r * CELL, d, hash(r, c))
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

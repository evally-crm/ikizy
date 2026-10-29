/**
 * gera public/email/flor.png: a flor de símbolos da landing (PixelFlower.astro) parada, branca sobre vinho,
 * para o e-mail de confirmação (e-mail não roda canvas). Uso: node scripts/email-flor.mjs
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const W = 560
const H = 230
const SCALE = 2
const STEP = 4
const PETALS = 5
const T = 2.2

const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
const hash = (a, b) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return s - Math.floor(s)
}
const waveAt = (x, y, t) =>
  (Math.sin(x * 0.05 + Math.sin(y * 0.04 + t * 0.6) * 2.4 + t) + Math.sin(y * 0.06 - x * 0.03 + 1.7 - t * 0.8) * 0.8 + 1.8) / 3.6

function density(dx, dy, t) {
  const r = Math.hypot(dx, dy)
  const a = Math.atan2(dy, dx) + 0.3 + 0.35 * r + t * 0.05
  const lobe = Math.abs(Math.cos((PETALS / 2) * a))
  const petal = (0.15 + 0.85 * Math.pow(lobe, 1.3)) * (1 + Math.sin(t * 0.7) * 0.04)
  const body = smooth(1.7, 0.1, r / petal) * 0.78
  const core = smooth(0.24, 0.02, r) * 0.7
  const vein = Math.pow(lobe, 40) * smooth(0.15, 0.4, r) * 0.25
  return Math.min(1, Math.max(body - vein, core))
}

const parts = []
const m = STEP / 2
const g = STEP * 0.3
const rect = (x, y, w, h) => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`)
const line = (x1, y1, x2, y2) => parts.push(`<path d="M${x1} ${y1}L${x2} ${y2}"/>`)

function glyph(x, y, d, mix) {
  if (d < 0.1) return
  if (d >= 0.56 && mix < 0.45) d = 0.5
  if (d < 0.24) return rect(x + m - 0.5, y + m - 0.5, 1, 1)
  if (d < 0.4) {
    line(x + m, y + m - g, x + m, y + m + g)
    return line(x + m - g, y + m, x + m + g, y + m)
  }
  if (d < 0.56) {
    const k = g * 0.9
    line(x + m - k, y + m - k, x + m + k, y + m + k)
    return line(x + m + k, y + m - k, x + m - k, y + m + k)
  }
  if (d < 0.72) return rect(x + m - g, y + m - g, g * 2, g * 2)
  rect(x + 0.5, y + 0.5, STEP - 1, STEP - 1)
}

const S = H * 0.5
const cx = W * 0.74
const cy = H * 0.5
for (let row = 0, y = 0; y < H; row++, y += STEP) {
  for (let col = 0, x = 0; x < W; col++, x += STEP) {
    const dx = (x + m - cx) / S
    const dy = (y + m - cy) / S
    const n = hash(row, col)
    const wave = waveAt(x, y, T)
    let d = density(dx, dy, T)
    if (d <= 0.03) {
      const r = Math.hypot(dx, dy)
      if (r < 1.7 && n < smooth(1.7, 0.5, r) * 0.55 * (0.6 + wave * 0.6)) d = 0.12 + n * 0.3
      else continue
    } else d = d * (0.7 + 0.3 * wave)
    glyph(x, y, d + (n - 0.5) * 0.4, hash(col, row))
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SCALE}" height="${H * SCALE}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#63001f"/>
<g fill="#fff" stroke="#fff" stroke-width="0.9" stroke-linecap="butt">${parts.join('')}</g></svg>`

const out = fileURLToPath(new URL('../public/email/flor.png', import.meta.url))
mkdirSync(fileURLToPath(new URL('../public/email/', import.meta.url)), { recursive: true })
const png = await sharp(Buffer.from(svg)).png({ palette: true, colors: 4 }).toBuffer()
writeFileSync(out, png)
console.log(`flor.png: ${png.length} bytes`)

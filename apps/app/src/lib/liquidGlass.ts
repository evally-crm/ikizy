/**
 * vidro líquido (refração de verdade, à la iOS 26), seguindo https://kube.io/blog/liquid-glass-css-svg/:
 * a borda da peça é uma lente convexa; pela lei de Snell calculamos quanto cada ponto da borda "puxa" o fundo para dentro,
 * gravamos isso num mapa de deslocamento (vermelho = x, verde = y) e o <feDisplacementMap> do SVG entorta o que está atrás.
 * Por cima vai um brilho fino na borda, mais forte onde a luz (de cima à esquerda) bate.
 *
 * Só o Chrome/Android aceita filtro SVG em `backdrop-filter`; no Safari a peça segue com o vidro desfocado de sempre.
 */

export interface GlassShape {
  width: number
  height: number
  /** raio dos cantos; por padrão, pílula (metade da menor medida) */
  radius?: number
  /** largura da borda curva, em px */
  bezel?: number
  /** espessura do vidro: quanto mais grosso, mais entorta */
  thickness?: number
}

export interface GlassMaps {
  displacement: string
  specular: string
  /** deslocamento máximo em px (vira o `scale` do feDisplacementMap) */
  scale: number
}

/** índice de refração do vidro */
const IOR = 1.5
/** amostras ao longo da borda (o mapa tem 8 bits por canal, mais que isso não aparece) */
const SAMPLES = 128

/** perfil da borda: "squircle" convexo, sobe rápido e achata sem quina (o que a Apple parece usar) */
const surface = (t: number) => Math.pow(1 - Math.pow(1 - t, 4), 1 / 4)

/** deslocamento (px) em cada ponto da borda, de fora (0) para dentro (1) */
function refractionProfile(bezel: number, thickness: number) {
  const out = new Float32Array(SAMPLES)
  const d = 0.001
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / SAMPLES
    const h = surface(t) * thickness
    const slope = ((surface(Math.min(1, t + d)) - surface(Math.max(0, t - d))) / (2 * d)) * (thickness / bezel)
    const incidence = Math.atan(slope)
    const refracted = Math.asin(Math.sin(incidence) / IOR)
    out[i] = h * Math.tan(incidence - refracted)
  }
  return out
}

const cache = new Map<string, GlassMaps>()

export function glassMaps({ width, height, radius, bezel = 12, thickness = 18 }: GlassShape): GlassMaps | null {
  const w = Math.round(width)
  const h = Math.round(height)
  if (w < 2 || h < 2) return null
  const r = Math.min(radius ?? Math.min(w, h) / 2, Math.min(w, h) / 2)
  const b = Math.max(1, Math.min(bezel, r))
  const key = `${w}x${h}r${r}b${b}t${thickness}`
  const hit = cache.get(key)
  if (hit) return hit

  const profile = refractionProfile(b, thickness)
  const max = Math.max(...profile) || 1
  // luz vindo de cima, levemente da esquerda
  const lx = -0.45
  const ly = -0.89

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const disp = ctx.createImageData(w, h)
  const spec = ctx.createImageData(w, h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      disp.data[i] = 128
      disp.data[i + 1] = 128
      disp.data[i + 2] = 128
      disp.data[i + 3] = 255
      // distância até a borda do retângulo arredondado
      const px = x + 0.5
      const py = y + 0.5
      const cx = Math.min(Math.max(px, r), w - r)
      const cy = Math.min(Math.max(py, r), h - r)
      const dx = px - cx
      const dy = py - cy
      const dist = Math.hypot(dx, dy)
      const fromEdge = r - dist
      if (fromEdge < 0 || fromEdge >= b || dist === 0) continue
      const t = fromEdge / b
      const mag = profile[Math.min(SAMPLES - 1, Math.floor(t * SAMPLES))] / max
      const nx = dx / dist
      const ny = dy / dist
      // a borda convexa traz o fundo de mais para dentro
      disp.data[i] = Math.round(128 - nx * mag * 127)
      disp.data[i + 1] = Math.round(128 - ny * mag * 127)
      // brilho: aro fino na beirada + um véu que some para dentro, mais forte onde a luz bate (dos dois lados)
      const facing = Math.abs(nx * lx + ny * ly)
      const rim = Math.max(0, 1 - fromEdge / 1.6)
      const glow = Math.pow(1 - t, 4) * 0.22
      const a = Math.min(1, facing * (rim * 0.95 + glow) + rim * 0.15)
      spec.data[i] = 255
      spec.data[i + 1] = 255
      spec.data[i + 2] = 255
      spec.data[i + 3] = Math.round(a * 255)
    }
  }

  ctx.putImageData(disp, 0, 0)
  const displacement = canvas.toDataURL()
  ctx.clearRect(0, 0, w, h)
  ctx.putImageData(spec, 0, 0)
  const specular = canvas.toDataURL()
  const maps = { displacement, specular, scale: max }
  cache.set(key, maps)
  return maps
}

/** só os navegadores Chromium aplicam filtro SVG no que está atrás da peça */
export const supportsLiquidGlass =
  typeof navigator !== 'undefined' && 'userAgentData' in navigator && typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', 'url(#a)')

/**
 * desenhos em símbolos da landing, no estilo do rosto do login: cada célula da grade vira
 * nada · ponto · + · x · quadradinho · quadrado conforme o tom. dois desenhos, o coelho da marca e a boca,
 * e o relógio da troca entre eles (PixelMorph.astro).
 */

/** valor especial de uma célula: pintada com a cor de destaque (a boca do coelho) */
export const ACCENT = -1

export const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
export const hash = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/** símbolo da célula conforme o tom; nas áreas cheias parte das células vira x, como na impressão de referência */
export function glyph(ctx: CanvasRenderingContext2D, x: number, y: number, step: number, d: number, mix: number) {
  const m = step / 2
  const g = step * 0.3
  const dot = step * 0.13
  if (d < 0.1) return
  if (d >= 0.56 && mix < 0.3) d = 0.5
  if (d < 0.24) return ctx.fillRect(x + m - dot, y + m - dot, dot * 2, dot * 2)
  ctx.beginPath()
  if (d < 0.4) {
    ctx.moveTo(x + m, y + m - g)
    ctx.lineTo(x + m, y + m + g)
    ctx.moveTo(x + m - g, y + m)
    ctx.lineTo(x + m + g, y + m)
    return ctx.stroke()
  }
  if (d < 0.56) {
    const k = g * 0.9
    ctx.moveTo(x + m - k, y + m - k)
    ctx.lineTo(x + m + k, y + m + k)
    ctx.moveTo(x + m + k, y + m - k)
    ctx.lineTo(x + m - k, y + m + k)
    return ctx.stroke()
  }
  if (d < 0.72) return ctx.fillRect(x + m - g, y + m - g, g * 2, g * 2)
  const p = step / 8
  ctx.fillRect(x + p, y + p, step - 2 * p, step - 2 * p)
}

/** um quadro de desenho: tamanho do canvas em px, tempo em s e tamanho da célula */
export interface Frame {
  width: number
  height: number
  t: number
  step: number
}
/** tom final da célula (col, row): < 0.1 fica vazia; ACCENT pinta com a cor de destaque */
export type Field = (col: number, row: number) => number

// ---------- coelho ----------

// o coelho num quadro de 14 x 26 unidades (o desenho da logo, BunnyMark.astro, dividido por 10)
const BW = 14
const BH = 26

/** distância até um retângulo arredondado (negativa dentro) */
const box = (x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number) => {
  const qx = Math.abs(x - (x0 + x1) / 2) - (x1 - x0) / 2 + r
  const qy = Math.abs(y - (y0 + y1) / 2) - (y1 - y0) / 2 + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/** distância até o contorno do coelho, em unidades do quadro */
function bunnyShape(x: number, y: number, t: number) {
  // a orelha direita balança um tiquinho
  const ear = Math.sin(t * 0.9) * 0.25 * smooth(14, 7, y)
  return Math.min(
    box(x, y, 0, 0, 4.2, 14.4, 0.5),
    box(x - ear, y, 10.5, 7.1, 14, 14, 0.5),
    box(x, y, 0, 13.8, 10.8, 18, 0.3),
    box(x, y, 0, 17.6, 14, 26, 2.2),
  )
}

const isMouth = (x: number, y: number) => Math.abs(x - 6.95) < 0.95 && Math.abs(y - 21.5) < 0.45

/** tom (0 claro .. 1 cheio): corpo cheio com sombra na borda, bochechas mais claras, olhos e boca vazados */
function bunnyTone(x: number, y: number, t: number, soft: boolean) {
  const d = bunnyShape(x, y, t)
  if (d > (soft ? 5 : 2.6)) return 0
  const edge = soft ? 2.2 : 0.7
  const body = smooth(edge, -edge, d)
  // sombreado como no rosto do login: mais cheio perto da borda, mais leve no miolo e no alto das orelhas
  const inner = smooth(0, -2.4, d)
  const light = 0.3 * inner + 0.22 * smooth(15, 1, y)
  const cheek = Math.max(smooth(2.2, 0.6, Math.hypot(x - 2.4, y - 22.4)), smooth(2.2, 0.6, Math.hypot(x - 11.6, y - 22.4))) * 0.3
  let v = body * (1 - light - cheek)
  if (soft) {
    // manchas de tom que andam devagar, como a luz no rosto do login
    const blot = Math.sin(x * 0.55 + Math.sin(y * 0.3 + t * 0.4) * 1.6) * Math.sin(y * 0.42 - x * 0.2 - t * 0.3)
    const cloud = Math.sin(x * 0.22 + y * 0.12 + Math.sin(y * 0.16 - t * 0.25) * 2.2) * Math.sin(y * 0.2 - x * 0.1 + t * 0.2)
    // luz vinda da direita: o desenho vai se desfazendo em nuvens de símbolos para esse lado, como o rosto do login
    const lit = 1.1 - 0.5 * smooth(2, 15, x + Math.sin(y * 0.25 + t * 0.3) * 1.5)
    v *= (0.72 + 0.3 * blot + 0.2 * cloud) * lit
  }
  // olhos em +, e a boca, um tracinho
  const blink = Math.sin(t * 0.5) > 0.985 ? 0 : 1
  const eye = (cx: number) =>
    (Math.abs(x - cx) < 0.55 && Math.abs(y - 19.9) < 1.6 * blink + 0.3) || (Math.abs(y - 19.9) < 0.5 && Math.abs(x - cx) < 1.4)
  if (eye(4.1) || eye(9.8) || isMouth(x, y)) v = 0
  // pó solto em volta
  if (d > 0) v = Math.max(v, smooth(soft ? 5 : 1.8, 0, d) * (soft ? 0.36 : 0.26))
  return v
}

export interface BunnyOptions {
  /** pinta a boca com a cor de destaque (senão ela fica vazada) */
  accent?: boolean
  /** mais abstrato: borda bem esfumada, manchas de tom e mais pó */
  soft?: boolean
  /** sobe o coelho, para o rosto ficar acima do ticket de cadastro */
  lift?: boolean
}

/** o coelho centrado (ou erguido), respirando e ondulando */
export function bunnyField({ width, height, t, step }: Frame, { accent, soft, lift }: BunnyOptions = {}): Field {
  const k = 4 / step // ondas na mesma escala do desenho, em qualquer tamanho de célula
  const breathe = 1 + Math.sin(t * 0.8) * 0.015
  const unit = Math.min((width * (soft ? 0.95 : 0.8)) / BW, (height * (lift ? 0.8 : soft ? 0.95 : 0.82)) / BH) * breathe
  const ox = (width - BW * unit) / 2
  const oy = lift ? height * 0.04 : (height - BH * unit) / 2
  return (col, row) => {
    const x = col * step
    const y = row * step
    const ux = (x + step / 2 - ox) / unit + Math.sin(y * 0.08 * k + t * 0.8) * 0.12
    const uy = (y + step / 2 - oy) / unit + Math.sin(x * 0.07 * k - t * 0.6) * 0.12
    if (accent && isMouth(ux, uy)) return ACCENT
    const v = bunnyTone(ux, uy, t, !!soft)
    if (v <= 0.02) return 0
    const wave = (Math.sin(x * 0.05 * k + Math.sin(y * 0.04 * k + t * 0.6) * 2.4 + t) + 1) / 2
    return v * (0.9 + 0.12 * wave) + (hash(row, col) - 0.5) * (soft ? 0.36 : 0.22)
  }
}

// ---------- boca ----------

const bell = (x: number, w: number) => Math.exp(-((x / w) ** 2))

// contornos arredondados em u ∈ [-1, 1]: oval com um leve arco do cupido, e a abertura no meio
const lipTop = (u: number) => -0.56 * Math.pow(1 - u * u, 0.6) + 0.11 * bell(u, 0.14)
const lipBottom = (u: number) => 0.58 * Math.pow(1 - u * u, 0.55)
const OPEN_W = 0.52
const opening = (u: number, t: number) => Math.sqrt(Math.max(0, 1 - (u / OPEN_W) ** 2)) * (1 + Math.sin(t * 0.7) * 0.06)

/** densidade (0..1) da boca: cheia no meio dos lábios, esfumando perto da borda e da abertura */
function mouthDensity(u: number, v: number, t: number) {
  if (Math.abs(u) >= 1) return 0
  const o = opening(u, t)
  const ui = -0.12 * o
  const li = 0.14 * o
  const tp = lipTop(u)
  const bt = lipBottom(u)
  if (v < tp - 0.14 || v > bt + 0.14) return 0
  if (v > ui && v < li) return 0
  // distância (em u) até a borda mais próxima: de fora ou da abertura
  const out = Math.min(v - tp, bt - v)
  const inner = v <= ui ? ui - v : v - li
  const lipLine = Math.abs(v) < 0.03 && o === 0 ? 0.35 : 0 // fenda entre os lábios perto dos cantos
  return Math.max(0, smooth(-0.08, 0.26, out) * smooth(-0.01, 0.14, inner) - lipLine)
}

/** a boca aberta no meio do quadro, com volume nos lábios, pó em volta e ondas que fazem os símbolos irem e voltarem */
export function mouthField({ width, height, t, step }: Frame): Field {
  const S = Math.min(width * 0.42, height * 0.62)
  const cx = width / 2
  const cy = height * 0.44
  const k = 7 / step // ondas na mesma escala do desenho, em qualquer tamanho de célula
  return (col, row) => {
    const x = col * step + step / 2
    const y = row * step + step / 2
    const u = (x - cx) / S + Math.sin(y * 0.02 * k + t * 0.8) * 0.01
    const v = (y - cy) / S + Math.sin(x * 0.017 * k - t * 0.6) * 0.01
    const n = hash(row, col)
    const wave =
      (Math.sin(x * 0.012 * k + Math.sin(y * 0.009 * k + t * 0.6) * 2.4 + t) + Math.sin(y * 0.014 * k - x * 0.007 * k + 1.7 - t * 0.8) * 0.8 + 1.8) / 3.6
    let d = mouthDensity(u, v, t)
    // manchas largas e luz da direita, como no coelho
    const cloud = 0.6 + 0.4 * Math.sin(u * 5 + Math.sin(v * 3.5 - t * 0.3) * 1.8) * Math.sin(v * 4.2 - u * 1.5 + t * 0.25) + 0.25 * Math.sin(x * 0.03 * k - t * 0.4)
    d *= cloud * (1.15 - 0.6 * smooth(-0.6, 0.9, u))
    if (d <= 0.02) {
      // pontinhos e + soltos em volta, como pó
      const e = Math.hypot(u / 1.12, v / 0.78)
      const inMouth = Math.abs(u) < OPEN_W + 0.06 && Math.abs(v) < 0.2
      if (inMouth || e >= 1.5 || n >= smooth(1.5, 0.7, e) * 0.55 * wave) return 0
      d = 0.15 + n * 0.4
    } else {
      // volume dos lábios: mais escuro junto à abertura e brilho no lábio de baixo
      const gloss = bell(u - 0.12, 0.25) * bell(v - 0.36, 0.08) * 0.45
      const rim = bell(Math.abs(v) - 0.16, 0.06) * 0.2
      d = d * (0.84 + 0.16 * wave) + rim - gloss
    }
    return d + (n - 0.5) * 0.14
  }
}

// ---------- troca entre dois desenhos ----------

/** quanto tempo cada desenho fica parado e quanto dura a troca, em s */
export const HOLD = 5
export const SWAP = 1.6

/**
 * 0 mostra o primeiro desenho, 1 o segundo
 */
export function swapProgress(t: number) {
  const period = HOLD + SWAP
  const k = t % (2 * period)
  if (k < HOLD) return 0
  if (k < period) return smooth(0, 1, (k - HOLD) / SWAP)
  if (k < period + HOLD) return 1
  return 1 - smooth(0, 1, (k - period - HOLD) / SWAP)
}

// ---------- canvas ----------

/**
 * desenha no canvas a ~30 quadros por segundo enquanto ele aparece na tela; com movimento reduzido,
 * desenha uma vez (tempo zero) e só redesenha quando o tamanho muda
 */
export function animate(canvas: HTMLCanvasElement, paint: (ctx: CanvasRenderingContext2D, frame: Omit<Frame, 'step'>) => void) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  let visible = true
  let last = 0

  const draw = (t: number) => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return
    const w = Math.round(width * dpr)
    const h = Math.round(height * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    paint(ctx, { width, height, t })
  }

  if (still) {
    draw(0)
    new ResizeObserver(() => draw(0)).observe(canvas)
    return
  }
  new IntersectionObserver((e) => (visible = e[0].isIntersecting)).observe(canvas)
  const tick = (now: number) => {
    if (visible && now - last >= 1000 / 30) {
      last = now
      draw(now / 1000)
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/** pinta um campo inteiro na grade: tinta na cor do texto do canvas, destaque na cor dada */
export function paintField(ctx: CanvasRenderingContext2D, field: Field, { width, height, step }: Frame, ink: string, accent?: string) {
  ctx.lineWidth = step * 0.2
  ctx.fillStyle = ctx.strokeStyle = ink
  const cols = Math.ceil(width / step)
  const rows = Math.ceil(height / step)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const d = field(col, row)
      if (d === ACCENT) {
        if (!accent) continue
        ctx.fillStyle = accent
        ctx.fillRect(col * step + step / 8, row * step + step / 8, step * 0.75, step * 0.75)
        ctx.fillStyle = ink
        continue
      }
      glyph(ctx, col * step, row * step, step, d, hash(col, row))
    }
  }
}

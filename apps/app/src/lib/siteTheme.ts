/** cores, tema, fonte e categorias do site do negócio; usado pelo app (prévia) e pelo servidor (página pública), sem React */
export type AccentId = 'bordo' | 'rubi' | 'vinho'

export const ACCENTS: Record<AccentId, { label: string; color: string; soft: string }> = {
  bordo: { label: 'Bordô', color: '#460106', soft: '#f3dfe1' },
  rubi: { label: 'Rubi', color: '#bf0c22', soft: '#fbe0e4' },
  vinho: { label: 'Vinho', color: '#800513', soft: '#f6dde0' },
}

export const isAccentId = (v: unknown): v is AccentId => typeof v === 'string' && v in ACCENTS

export const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

// ---------------------------------------------------------------- tema (fundo da página)

export type ThemeId = 'claro' | 'bege' | 'escuro'

export interface ThemeTokens {
  label: string
  /** fundo da página */
  bg: string
  /** painéis e janelas */
  panel: string
  /** títulos */
  ink: string
  /** texto corrido */
  text: string
  /** texto de apoio */
  muted: string
  /** bordas */
  line: string
  dark: boolean
}

export const THEMES: Record<ThemeId, ThemeTokens> = {
  claro: { label: 'Claro', bg: '#efebe5', panel: '#ffffff', ink: '#0e0d0d', text: '#242424', muted: '#6b6668', line: '#e5e1dc', dark: false },
  bege: { label: 'Bege', bg: '#e9dcc3', panel: '#f8f2e6', ink: '#1d1710', text: '#2b241b', muted: '#6f6555', line: '#dccfb4', dark: false },
  escuro: { label: 'Escuro', bg: '#0e0d0d', panel: '#1a1919', ink: '#ffffff', text: '#e9e6e7', muted: '#a39fa1', line: '#2c2a2b', dark: true },
}

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && v in THEMES

// ---------------------------------------------------------------- fonte dos títulos

export type FontId = 'moderna' | 'elegante' | 'forte'

export const FONTS: Record<FontId, { label: string; sample: string; family: string; weight: number; upper: boolean }> = {
  moderna: { label: 'Moderna', sample: 'Leve e atual', family: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', weight: 400, upper: false },
  elegante: { label: 'Elegante', sample: 'Fina e sofisticada', family: 'Georgia,"Times New Roman",serif', weight: 400, upper: false },
  forte: { label: 'Forte', sample: 'MARCANTE', family: '"Arial Narrow","Helvetica Neue",Arial,sans-serif', weight: 800, upper: true },
}

export const isFontId = (v: unknown): v is FontId => typeof v === 'string' && v in FONTS

// ---------------------------------------------------------------- cor de destaque

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const mix = (hex: string, other: number, t: number) => toHex(rgb(hex).map((v) => v * (1 - t) + other * t))
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** clareia mantendo o tom e a saturação (misturar com branco deixaria a cor lavada) */
function lighten(hex: string, minLuminance: number): string {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let l = (max + min) / 2
  const d = max - min
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const out = (light: number) => {
    const c = (1 - Math.abs(2 * light - 1)) * sat
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = light - c / 2
    const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
    return toHex([(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255])
  }
  let color = hex
  while (luminance(color) < minLuminance && l < 0.9) {
    l += 0.02
    color = out(l)
  }
  return color
}

export interface ResolvedAccent {
  color: string
  soft: string
  /** cor do texto sobre a cor de destaque (botões) */
  on: string
}

/**
 * Cor de destaque do site: a própria (#rrggbb) quando válida, senão a escolhida da lista.
 * - tema claro/bege: o texto dos botões é branco, então cores claras demais são escurecidas até dar contraste (4,5:1);
 * - tema escuro: a cor aparece em textos sobre fundo escuro, então cores escuras demais são clareadas e o botão usa texto escuro.
 */
export function resolveAccent(id: unknown, custom?: unknown, theme: unknown = 'claro'): ResolvedAccent {
  const dark = isThemeId(theme) && THEMES[theme].dark
  let color = isHexColor(custom) ? custom.toLowerCase() : ACCENTS[isAccentId(id) ? id : 'bordo'].color

  if (dark) {
    color = lighten(color, 0.23)
    return { color, soft: mix(color, 0, 0.82), on: luminance(color) > 0.183 ? '#0e0d0d' : '#ffffff' }
  }

  if (isHexColor(custom)) {
    for (let i = 0; i < 12 && luminance(color) > 0.183; i++) color = mix(color, 0, 0.12)
    return { color, soft: mix(color, 255, 0.88), on: '#ffffff' }
  }
  return { ...ACCENTS[isAccentId(id) ? id : 'bordo'], on: '#ffffff' }
}

export const CATEGORIES = ['Unhas', 'Cílios', 'Sobrancelha', 'Cabelo', 'Estética'] as const
export type Category = (typeof CATEGORIES)[number]

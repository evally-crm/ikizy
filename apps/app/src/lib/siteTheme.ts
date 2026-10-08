/** paletas, fontes e categorias do site do negócio; usado pelo app (prévia) e pelo servidor (página pública), sem React */

// ---------------------------------------------------------------- paletas (cores fixas, já combinadas e testadas)

export type PaletteId = 'bordo' | 'rubi' | 'vinho' | 'rose' | 'cafe' | 'floresta' | 'marinho' | 'noir' | 'toledo'

export interface Palette {
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
  /** cor de destaque: botões, itálicos e preços */
  accent: string
  /** tom suave da cor de destaque, para cartões */
  soft: string
  /** cor do texto sobre a cor de destaque */
  on: string
  dark: boolean
}

const LIGHT = { bg: '#efebe5', panel: '#ffffff', ink: '#0e0d0d', text: '#242424', muted: '#6b6668', line: '#e5e1dc', on: '#ffffff', dark: false }

export const PALETTES: Record<PaletteId, Palette> = {
  bordo: { ...LIGHT, label: 'Bordô', accent: '#460106', soft: '#f3dfe1' },
  rubi: { ...LIGHT, label: 'Rubi', accent: '#bf0c22', soft: '#fbe0e4' },
  vinho: { ...LIGHT, label: 'Vinho', accent: '#800513', soft: '#f6dde0' },
  rose: { label: 'Rosé', bg: '#f6e6e3', panel: '#fffaf9', ink: '#2a1618', text: '#3a2326', muted: '#7a5f63', line: '#ecd3d0', accent: '#a23a56', soft: '#f5dde2', on: '#ffffff', dark: false },
  cafe: { label: 'Café', bg: '#e9dcc3', panel: '#f8f2e6', ink: '#1d1710', text: '#2b241b', muted: '#6f6555', line: '#dccfb4', accent: '#5b3a1e', soft: '#efe3cf', on: '#ffffff', dark: false },
  floresta: { label: 'Floresta', bg: '#e3e8df', panel: '#f6f8f3', ink: '#0f1a14', text: '#1f2b24', muted: '#5d6b62', line: '#d3dbcf', accent: '#1f4d3a', soft: '#dbe7df', on: '#ffffff', dark: false },
  marinho: { label: 'Marinho', bg: '#e2e7ef', panel: '#f6f8fb', ink: '#0d1524', text: '#1c2538', muted: '#5a6477', line: '#d3dae6', accent: '#1b2f55', soft: '#dce4f1', on: '#ffffff', dark: false },
  noir: { label: 'Noir', bg: '#0e0d0d', panel: '#1a1919', ink: '#ffffff', text: '#e9e6e7', muted: '#a39fa1', line: '#2c2a2b', accent: '#d9b36c', soft: '#2b2416', on: '#0e0d0d', dark: true },
  toledo: { label: 'Toledo', bg: '#1b0a10', panel: '#2a1219', ink: '#ffffff', text: '#f0e4e7', muted: '#b59ca2', line: '#43232d', accent: '#f0b6bf', soft: '#3a1b24', on: '#1b0a10', dark: true },
}

export const isPaletteId = (v: unknown): v is PaletteId => typeof v === 'string' && v in PALETTES

/**
 * Paleta de um site. Sites antigos guardavam cor (bordo/rubi/vinho) e tema (claro/bege/escuro) separados:
 * escuro vira Noir, bege vira Café e, no claro, vale a cor que tinham escolhido.
 */
export function paletteFor(settings: { palette?: unknown; accent?: unknown; theme?: unknown }): { id: PaletteId; p: Palette } {
  let id: PaletteId = 'bordo'
  if (isPaletteId(settings.palette)) id = settings.palette
  else if (settings.theme === 'escuro') id = 'noir'
  else if (settings.theme === 'bege') id = 'cafe'
  else if (isPaletteId(settings.accent)) id = settings.accent
  return { id, p: PALETTES[id] }
}

// ---------------------------------------------------------------- fonte dos títulos

export type FontId = 'moderna' | 'elegante' | 'forte'

export const FONTS: Record<FontId, { label: string; sample: string; family: string; weight: number; upper: boolean }> = {
  moderna: { label: 'Moderna', sample: 'Leve e atual', family: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', weight: 400, upper: false },
  elegante: { label: 'Elegante', sample: 'Fina e sofisticada', family: 'Georgia,"Times New Roman",serif', weight: 400, upper: false },
  forte: { label: 'Forte', sample: 'MARCANTE', family: '"Arial Narrow","Helvetica Neue",Arial,sans-serif', weight: 800, upper: true },
}

export const isFontId = (v: unknown): v is FontId => typeof v === 'string' && v in FONTS

export const CATEGORIES = ['Unhas', 'Cílios', 'Sobrancelha', 'Cabelo', 'Estética'] as const
export type Category = (typeof CATEGORIES)[number]

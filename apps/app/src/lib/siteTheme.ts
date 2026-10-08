/** paletas, fontes e categorias do site do negócio; usado pelo app (prévia) e pelo servidor (página pública), sem React */

// ---------------------------------------------------------------- paletas (cores fixas, já combinadas e testadas)

export type PaletteId = 'branco-bege' | 'rosa-branco' | 'bege-preto' | 'gelo-branco' | 'marinho-branco' | 'vinho-preto' | 'creme-pinho'

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

/**
 * Só as combinações escolhidas para o produto (duas cores cada). Nas cores claras (bege, rosa bebê, azul gelo),
 * o destaque usa um tom mais fechado da mesma cor para o texto continuar legível.
 */
export const PALETTES: Record<PaletteId, Palette> = {
  'branco-bege': { label: 'Branco e bege', bg: '#f6f1ea', panel: '#ffffff', ink: '#1f1a14', text: '#2e2720', muted: '#6e6356', line: '#e8dfd3', accent: '#6f5c48', soft: '#efe6da', on: '#ffffff', dark: false },
  'rosa-branco': { label: 'Rosa bebê', bg: '#fbeef2', panel: '#ffffff', ink: '#2a1a20', text: '#3a2730', muted: '#7a5f69', line: '#f1dbe3', accent: '#a3405f', soft: '#f9e1ea', on: '#ffffff', dark: false },
  'bege-preto': { label: 'Bege e preto', bg: '#e8dccb', panel: '#f6efe5', ink: '#111111', text: '#1d1a17', muted: '#5f564c', line: '#d9cbb7', accent: '#111111', soft: '#e9dfd0', on: '#f6efe5', dark: false },
  'gelo-branco': { label: 'Azul gelo', bg: '#e8f0f9', panel: '#ffffff', ink: '#0f1b2b', text: '#1d2a3b', muted: '#56657a', line: '#d6e2f0', accent: '#2f5d8f', soft: '#dce8f6', on: '#ffffff', dark: false },
  'marinho-branco': { label: 'Azul-marinho', bg: '#f4f6fa', panel: '#ffffff', ink: '#0d1530', text: '#1a2340', muted: '#59627a', line: '#e1e6ef', accent: '#1b2a55', soft: '#e2e7f2', on: '#ffffff', dark: false },
  'vinho-preto': { label: 'Vinho e preto', bg: '#f2eded', panel: '#ffffff', ink: '#0e0d0d', text: '#1f1c1c', muted: '#6b6566', line: '#e6dfdf', accent: '#6e1423', soft: '#f4e1e4', on: '#ffffff', dark: false },
  'creme-pinho': { label: 'Creme e pinho', bg: '#fffbda', panel: '#fffdf0', ink: '#00371c', text: '#10301f', muted: '#4f5f53', line: '#ede7bf', accent: '#00371c', soft: '#f3efc8', on: '#fffbda', dark: false },
}

export const DEFAULT_PALETTE: PaletteId = 'vinho-preto'

export const isPaletteId = (v: unknown): v is PaletteId => typeof v === 'string' && v in PALETTES

/** paletas que existiram antes (e cores/temas mais antigos ainda) -> combinação atual mais próxima */
const LEGACY: Record<string, PaletteId> = {
  bordo: 'vinho-preto',
  rubi: 'vinho-preto',
  vinho: 'vinho-preto',
  toledo: 'vinho-preto',
  rose: 'rosa-branco',
  cafe: 'bege-preto',
  noir: 'bege-preto',
  floresta: 'creme-pinho',
  marinho: 'marinho-branco',
  escuro: 'bege-preto',
  bege: 'branco-bege',
}

/** paleta de um site: a salva, senão a equivalente das escolhas antigas, senão a padrão */
export function paletteFor(settings: { palette?: unknown; accent?: unknown; theme?: unknown }): { id: PaletteId; p: Palette } {
  let id: PaletteId = DEFAULT_PALETTE
  const legacy = (v: unknown) => (typeof v === 'string' ? LEGACY[v] : undefined)
  if (isPaletteId(settings.palette)) id = settings.palette
  else if (legacy(settings.palette)) id = legacy(settings.palette)!
  else if (legacy(settings.theme)) id = legacy(settings.theme)!
  else if (legacy(settings.accent)) id = legacy(settings.accent)!
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

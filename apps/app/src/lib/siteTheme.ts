/** paletas, fontes e categorias do site do negócio; usado pelo app (prévia) e pelo servidor (página pública), sem React */

// ---------------------------------------------------------------- paletas (cores fixas, já combinadas e testadas)

export type PaletteId = 'vermelho' | 'rosa-bebe' | 'verde-musgo' | 'rosa' | 'roxo' | 'azul' | 'preto' | 'marrom'

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
  /** cor da paleta, exata: botões, capa e blocos de cor */
  accent: string
  /** a cor da paleta quando vira texto (itálicos e preços); nas cores claras, um tom mais fechado para continuar legível */
  accentInk: string
  /** tom suave da cor, para cartões */
  soft: string
  /** cor do texto sobre a cor da paleta */
  on: string
  dark: boolean
}

/**
 * Uma cor por paleta, nas cores escolhidas para o produto; o fundo e os cartões são a mesma cor bem clarinha.
 * Rosa bebê e Rosa são claras demais para texto branco: o botão usa texto escuro e os itálicos/preços um tom mais fechado.
 */
export const PALETTES: Record<PaletteId, Palette> = {
  vermelho: { label: 'Vermelho', bg: '#f9f0f0', panel: '#ffffff', ink: '#1a0100', text: '#301110', muted: '#6a4645', line: '#eed7d6', accent: '#930500', accentInk: '#930500', soft: '#f4e6e6', on: '#ffffff', dark: false },
  'rosa-bebe': { label: 'Rosa bebê', bg: '#fbf1f8', panel: '#ffffff', ink: '#281823', text: '#402e3a', muted: '#7c6775', line: '#f5dbec', accent: '#dd88c1', accentInk: '#8d577c', soft: '#f8e7f3', on: '#4d3044', dark: false },
  'verde-musgo': { label: 'Verde musgo', bg: '#f2f5f1', panel: '#ffffff', ink: '#070f04', text: '#182214', muted: '#4e5a4a', line: '#dce4d9', accent: '#265514', accentInk: '#265514', soft: '#e9eee8', on: '#ffffff', dark: false },
  rosa: { label: 'Rosa', bg: '#fdf2f7', panel: '#ffffff', ink: '#290715', text: '#42182a', muted: '#7e4f63', line: '#fbdde9', accent: '#e52877', accentInk: '#c72368', soft: '#fceaf1', on: '#1e050f', dark: false },
  roxo: { label: 'Roxo', bg: '#f5f0f4', panel: '#ffffff', ink: '#0f000e', text: '#231021', muted: '#5a4658', line: '#e4d7e3', accent: '#56024d', accentInk: '#56024d', soft: '#eee6ed', on: '#ffffff', dark: false },
  azul: { label: 'Azul', bg: '#f0f5fb', panel: '#ffffff', ink: '#001021', text: '#102339', muted: '#465b74', line: '#d7e4f4', accent: '#0259ba', accentInk: '#0259ba', soft: '#e6eef8', on: '#ffffff', dark: false },
  preto: { label: 'Preto', bg: '#f2f2f2', panel: '#ffffff', ink: '#0d0d0d', text: '#1c1c1c', muted: '#5f5f5f', line: '#dddddd', accent: '#000000', accentInk: '#000000', soft: '#eaeaea', on: '#ffffff', dark: false },
  marrom: { label: 'Marrom', bg: '#f3f2f0', panel: '#ffffff', ink: '#0a0602', text: '#1b1712', muted: '#524e47', line: '#dfdcd8', accent: '#362209', accentInk: '#362209', soft: '#ebe9e6', on: '#ffffff', dark: false },
}

export const DEFAULT_PALETTE: PaletteId = 'vermelho'

export const isPaletteId = (v: unknown): v is PaletteId => typeof v === 'string' && v in PALETTES

/** paletas que existiram antes (e cores/temas mais antigos ainda) -> paleta atual mais próxima */
const LEGACY: Record<string, PaletteId> = {
  'vinho-preto': 'vermelho',
  'rosa-branco': 'rosa-bebe',
  'creme-pinho': 'verde-musgo',
  'gelo-branco': 'azul',
  'marinho-branco': 'azul',
  'bege-preto': 'preto',
  'preto-branco': 'preto',
  'branco-bege': 'marrom',
  bordo: 'vermelho',
  rubi: 'vermelho',
  vinho: 'vermelho',
  toledo: 'vermelho',
  rose: 'rosa-bebe',
  cafe: 'marrom',
  noir: 'preto',
  floresta: 'verde-musgo',
  marinho: 'azul',
  escuro: 'preto',
  bege: 'marrom',
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

export const FONTS: Record<FontId, { label: string; sample: string; family: string; weight: number; upper: boolean; google: string }> = {
  moderna: { label: 'Manrope', sample: 'Moderna', family: 'Manrope,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', weight: 600, upper: false, google: 'Manrope:wght@600' },
  elegante: { label: 'Forum', sample: 'Elegante', family: 'Forum,Georgia,"Times New Roman",serif', weight: 400, upper: false, google: 'Forum' },
  forte: { label: 'Raleway', sample: 'Forte', family: 'Raleway,"Helvetica Neue",Arial,sans-serif', weight: 800, upper: true, google: 'Raleway:wght@800' },
}

/** folha do Google Fonts com só a fonte escolhida (a página pública carrega apenas o necessário) */
export const fontHref = (id: FontId) => `https://fonts.googleapis.com/css2?family=${FONTS[id].google}&display=swap`

export const isFontId = (v: unknown): v is FontId => typeof v === 'string' && v in FONTS

// ---------------------------------------------------------------- estilo da capa (o que fica atrás do título)

export type CoverStyleId = 'sobrio' | 'poa' | 'xadrez' | 'editorial' | 'organico'

/** cinco estilos fixos; todos usam as cores da paleta escolhida, então combinam com qualquer uma */
export const COVER_STYLES: Record<CoverStyleId, { label: string; hint: string }> = {
  sobrio: { label: 'Sóbrio', hint: 'Cor lisa com degradê suave' },
  poa: { label: 'Poá', hint: 'Bolinhas delicadas' },
  xadrez: { label: 'Xadrez', hint: 'Vichy com cartão no centro' },
  editorial: { label: 'Editorial', hint: 'Fundo escuro e título grande' },
  organico: { label: 'Orgânico', hint: 'Formas suaves' },
}

export const DEFAULT_COVER_STYLE: CoverStyleId = 'sobrio'

export const isCoverStyleId = (v: unknown): v is CoverStyleId => typeof v === 'string' && v in COVER_STYLES

// mesma ordem do enum service_category no banco; "Outros" fica por último na página e no painel
export const CATEGORIES = ['Unhas', 'Cílios', 'Sobrancelha', 'Cabelo', 'Estética', 'Outros'] as const
export type Category = (typeof CATEGORIES)[number]

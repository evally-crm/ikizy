/** cores e categorias do site do negócio; usado pelo app (prévia) e pelo servidor (página pública), sem React */
export type AccentId = 'bordo' | 'rubi' | 'vinho'

export const ACCENTS: Record<AccentId, { label: string; color: string; soft: string }> = {
  bordo: { label: 'Bordô', color: '#460106', soft: '#f3dfe1' },
  rubi: { label: 'Rubi', color: '#bf0c22', soft: '#fbe0e4' },
  vinho: { label: 'Vinho', color: '#800513', soft: '#f6dde0' },
}

export const isAccentId = (v: unknown): v is AccentId => typeof v === 'string' && v in ACCENTS

export const CATEGORIES = ['Unhas', 'Cílios', 'Sobrancelha', 'Cabelo', 'Estética'] as const
export type Category = (typeof CATEGORIES)[number]

/** cores e categorias do site do negócio; usado pelo app (prévia) e pelo servidor (página pública), sem React */
export type AccentId = 'bordo' | 'rubi' | 'vinho'

export const ACCENTS: Record<AccentId, { label: string; color: string; soft: string }> = {
  bordo: { label: 'Bordô', color: '#460106', soft: '#f3dfe1' },
  rubi: { label: 'Rubi', color: '#bf0c22', soft: '#fbe0e4' },
  vinho: { label: 'Vinho', color: '#800513', soft: '#f6dde0' },
}

export const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

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

/**
 * Cor de destaque do site: a própria (#rrggbb) quando válida, senão a escolhida da lista.
 * Texto e botões usam branco sobre a cor, então cores claras demais são escurecidas até dar contraste (4,5:1).
 */
export function resolveAccent(id: unknown, custom?: unknown): { color: string; soft: string } {
  if (isHexColor(custom)) {
    let color = custom.toLowerCase()
    for (let i = 0; i < 12 && luminance(color) > 0.183; i++) color = mix(color, 0, 0.12)
    return { color, soft: mix(color, 255, 0.88) }
  }
  return ACCENTS[isAccentId(id) ? id : 'bordo']
}

export const isAccentId = (v: unknown): v is AccentId => typeof v === 'string' && v in ACCENTS

export const CATEGORIES = ['Unhas', 'Cílios', 'Sobrancelha', 'Cabelo', 'Estética'] as const
export type Category = (typeof CATEGORIES)[number]

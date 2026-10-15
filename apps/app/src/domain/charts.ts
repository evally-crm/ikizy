/** geometria dos gráficos: números prontos para desenhar, sem nada de tela */

/** pontos de uma linha (x,y em coordenadas do SVG); valores nulos (dias que não chegaram) ficam de fora */
export function linePoints(values: (number | null)[], width: number, height: number, padding = 3): string {
  const present = values.filter((v): v is number => v !== null)
  const max = Math.max(...present, 1)
  const step = width / Math.max(values.length - 1, 1)
  return values
    .map((v, i) => (v === null ? null : `${(i * step).toFixed(1)},${(height - (v / max) * (height - padding * 2) - padding).toFixed(1)}`))
    .filter((p): p is string => p !== null)
    .join(' ')
}

/** altura de cada barra em % da trilha: a maior ocupa 100%, valores acima de zero nunca somem (mínimo 12%) */
export function barHeights(values: number[], minimum = 12): number[] {
  const max = Math.max(...values, 1)
  return values.map((v) => (v > 0 ? Math.max(Math.round((v / max) * 100), minimum) : 0))
}

/** intensidade 0–4 de um valor num mapa de calor (0 = vazio, 4 = o melhor dia) */
export function heatLevel(value: number | null, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!value || max <= 0) return 0
  const ratio = value / max
  if (ratio > 0.75) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}

/** comprimento do traço de um medidor em meia-lua (valor em %, preso entre 0 e 100) */
export function gaugeDash(percent: number, length: number): string {
  const clamped = Math.min(Math.max(percent, 0), 100)
  return `${(length * clamped) / 100} ${length}`
}

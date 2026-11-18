/** avaliação como a dona vê na lista (o nome é o primeiro nome da ficha da cliente) */
export interface ReviewItem {
  id: string
  rating: number
  comment: string
  hidden: boolean
  createdAt: string
  service: string
  firstName: string
}

/** primeiro nome da ficha; vazio se a cliente foi removida (LGPD) */
export function firstNameOf(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n || n === 'Cliente removida') return ''
  return n.split(/\s+/)[0] ?? ''
}

/** o que o site mostra: só as que não foram escondidas entram na média e na contagem */
export function summarizeReviews(list: ReviewItem[]): { count: number; average: number | null; hidden: number } {
  const shown = list.filter((r) => !r.hidden)
  const sum = shown.reduce((n, r) => n + r.rating, 0)
  return {
    count: shown.length,
    average: shown.length ? Math.round((sum / shown.length) * 10) / 10 : null,
    hidden: list.length - shown.length,
  }
}

/** a mais nova primeiro */
export const newestFirst = (list: ReviewItem[]): ReviewItem[] => [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

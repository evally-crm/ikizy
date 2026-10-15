import type { ReactNode } from 'react'
import './Tag.css'

export type TagTone = 'vip' | 'nova' | 'sumida' | 'aniversario' | 'aconfirmar'

/** etiqueta pequena colorida (VIP, Nova, A confirmar...) */
export function Tag({ tone, children }: { tone: TagTone; children: ReactNode }) {
  return <span className={`tag tag--${tone}`}>{children}</span>
}

/** várias etiquetas lado a lado; some quando não há nenhuma */
export function Tags({ children }: { children: ReactNode }) {
  return <span className="tags">{children}</span>
}

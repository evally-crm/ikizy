import type { ReactNode } from 'react'
import './Tag.css'

export type TagTone = 'vip' | 'nova' | 'sumida' | 'aniversario' | 'aconfirmar'

/** cada etiqueta de cliente usa um dos tons padrão: sucesso, alerta, ruim, neutro e escuro */
const BADGE: Record<TagTone, string> = {
  vip: 'dark',
  nova: 'success',
  sumida: 'danger',
  aniversario: 'neutral',
  aconfirmar: 'warning',
}

/** etiqueta pequena colorida (VIP, Nova, A confirmar...) */
export function Tag({ tone, children }: { tone: TagTone; children: ReactNode }) {
  return <span className={`badge badge--${BADGE[tone]}`}>{children}</span>
}

/** várias etiquetas lado a lado; some quando não há nenhuma */
export function Tags({ children }: { children: ReactNode }) {
  return <span className="tags">{children}</span>
}

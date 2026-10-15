import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import './Section.css'

/** bloco do editor: título e uma frase curta; abre e fecha para a tela não ficar longa no celular */
export function Section({ title, hint, open, children }: { title: string; hint?: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="sect" open={open}>
      <summary className="sect__head">
        <span>
          <strong>{title}</strong>
          {hint && <small>{hint}</small>}
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="form">{children}</div>
    </details>
  )
}

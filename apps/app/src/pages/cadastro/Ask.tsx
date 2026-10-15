import type { ReactNode } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import './Ask.css'

/**
 * Campo único estilo barra de busca: ícone, o conteúdo (campo, chips, seletores) e o disco preto com seta,
 * que envia o formulário em volta. Mesmo visual dos campos em pílula do login.
 */
export function Ask({
  icon,
  goLabel,
  busy,
  children,
}: {
  icon?: ReactNode
  goLabel: string
  busy?: boolean
  children: ReactNode
}) {
  return (
    <div className="ask">
      {icon && (
        <span className="ask__ico" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="ask__body">{children}</div>
      <button type="submit" className="ask__go" aria-label={goLabel} title={goLabel} disabled={busy}>
        {busy ? <Loader2 size={20} className="ask__spin" aria-hidden="true" /> : <ArrowRight size={20} aria-hidden="true" />}
      </button>
    </div>
  )
}

/** chips de sugestão embaixo do campo; o marcado fica escuro */
export function Suggestions({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ask-sugs" role="group" aria-label={label}>
      {children}
    </div>
  )
}

export function Suggestion({ on, onClick, children }: { on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="ask-sug" aria-pressed={on ?? false} onClick={onClick}>
      {children}
    </button>
  )
}

/** botão escuro de seguir, para perguntas sem campo (cartões, revisão) */
export function Next({ label, busy, sticky }: { label: string; busy?: boolean; sticky?: boolean }) {
  return (
    <div className={sticky ? 'ask-next ask-next--sticky' : 'ask-next'}>
      <button type="submit" className="ask-next__btn" disabled={busy}>
        {label}
        {busy ? <Loader2 size={18} className="ask__spin" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
      </button>
    </div>
  )
}

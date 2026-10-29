import './PageLoader.css'
import { LogoWord } from './BunnyMark'

/** carregamento das telas: o logo pulsando, como na abertura do app, e (opcional) a silhueta dos blocos que vão chegar */
export function PageLoader({ label, blocks = 0 }: { label: string; blocks?: number }) {
  return (
    <div className="pageloader" role="status" aria-live="polite">
      <span className="pageloader__logo" aria-hidden="true">
        <LogoWord />
      </span>
      <span className="sr-only">{label}</span>
      {blocks > 0 && (
        <span className="pageloader__ghost" aria-hidden="true">
          {Array.from({ length: blocks }, (_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </span>
      )}
    </div>
  )
}

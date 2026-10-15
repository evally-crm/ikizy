import { WAFFLE_DOTS, type CompositionTone } from '../../domain/finance'
import './DotWaffle.css'

/** grade de pontos: cada ponto vale 2% do faturamento; a quantidade de cada parte já vem repartida pelo domínio */
export function DotWaffle({ parts }: { parts: { tone: CompositionTone; count: number }[] }) {
  const dots: (CompositionTone | 'empty')[] = parts.flatMap((p) => Array.from({ length: p.count }, () => p.tone))
  while (dots.length < WAFFLE_DOTS) dots.push('empty')
  return (
    <div className="waffle" aria-hidden="true">
      {dots.slice(0, WAFFLE_DOTS).map((tone, i) => (
        <i key={i} className={`waffle__dot waffle__dot--${tone}`} />
      ))}
    </div>
  )
}

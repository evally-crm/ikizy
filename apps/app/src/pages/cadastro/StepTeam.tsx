import { Check } from 'lucide-react'
import type { Team } from '../../domain/onboarding'
import { Next } from './Ask'
import './StepTeam.css'

const OPTIONS: { id: Team; title: string; text: string; columns: number }[] = [
  { id: 'solo', title: 'Só eu', text: 'Você atende e cuida da sua agenda.', columns: 1 },
  { id: 'equipe', title: 'Eu e equipe', text: 'Mais gente atende: cada uma tem sua coluna na agenda.', columns: 3 },
]

/** "Quem atende?": dois cartões, cada um com um desenho da agenda que vai ter */
export function StepTeam({ value, onChange }: { value: Team | null; onChange: (team: Team) => void }) {
  return (
    <>
      <div className="onb-team" role="radiogroup" aria-label="Quem atende">
        {OPTIONS.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="onb-team__card" onClick={() => onChange(o.id)}>
            <span className="onb-team__art" aria-hidden="true">
              {Array.from({ length: o.columns }, (_, c) => (
                <span key={c} className="onb-team__col">
                  <span className={`onb-team__bar onb-team__bar--${c}`} />
                  <span className={`onb-team__bar onb-team__bar--b${c}`} />
                </span>
              ))}
            </span>
            <span className="onb-team__row">
              <span className="onb-team__title">{o.title}</span>
              <span className="onb-team__radio" aria-hidden="true">
                {value === o.id && <Check size={14} />}
              </span>
            </span>
            <span className="onb-team__text">{o.text}</span>
          </button>
        ))}
      </div>
      <Next label="Continuar" />
    </>
  )
}

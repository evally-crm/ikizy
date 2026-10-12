import { PLAN_IDS, PLANS, type PlanId } from '../../lib/plans'
import { formatBRL } from '../../lib/format'

/** plano mais escolhido: já vem marcado, como na página de preços do site */
export const DEFAULT_PLAN: PlanId = 'studio'

const PLAN_LINE: Record<PlanId, string> = {
  solo: 'Para quem atende sozinha',
  studio: 'Equipe pequena, com comissões',
  salao: 'Equipe maior',
}

/** lista de escolha igual à do site: o marcado fica branco e os outros ficam cinza e apagados; 30 dias grátis em todos */
export function PlanChoice({ value, onChange }: { value: PlanId; onChange: (plan: PlanId) => void }) {
  return (
    <fieldset className="plans">
      <legend className="sr-only">Escolha seu plano</legend>
      {PLAN_IDS.map((id) => (
        <label key={id} className="plan">
          <input type="radio" name="plano" value={id} checked={value === id} onChange={() => onChange(id)} />
          <span className="plan__radio" aria-hidden="true" />
          <span className="plan__info">
            <b>{PLANS[id].name}</b>
            <small>{PLAN_LINE[id]}</small>
          </span>
          <span className="plan__price">
            <b>{formatBRL(PLANS[id].cents / 100)}</b>
            <small>/mês</small>
          </span>
          {id === DEFAULT_PLAN && <span className="plan__tag">Ideal para equipes</span>}
        </label>
      ))}
    </fieldset>
  )
}

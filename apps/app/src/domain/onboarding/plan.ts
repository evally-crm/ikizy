import { isPlanId, type PlanId } from '../../lib/plans'
import type { Team } from './steps'

/** plano do teste: o que veio do site (cartão de plano) ou o que combina com a resposta da equipe */
export function suggestedPlan(team: Team | null, fromSite: unknown): PlanId {
  if (isPlanId(fromSite)) return fromSite
  return team === 'equipe' ? 'studio' : 'solo'
}

export interface PlanFit {
  fits: boolean
  /** linha curta embaixo do preço: "Combina com você" / "Só para quem atende sozinha" */
  text: string
}

/** se o plano cabe no que a pessoa contou (sem resposta da equipe, não diz nada) */
export function planFit(plan: PlanId, team: Team | null): PlanFit | null {
  if (!team) return null
  if (team === 'solo') return plan === 'solo' ? { fits: true, text: 'Combina com você: só você atende' } : { fits: true, text: 'Cabe, e sobra espaço para crescer' }
  if (plan === 'solo') return { fits: false, text: 'Só para quem atende sozinha' }
  return { fits: true, text: plan === 'studio' ? 'Combina com você: cabe sua equipe' : 'Cabe sua equipe, mesmo grande' }
}

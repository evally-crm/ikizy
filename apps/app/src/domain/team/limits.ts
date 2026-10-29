import { PLAN_LIMITS, PLANS, type PlanId } from '../../lib/plans'

export interface LimitUse {
  used: number
  /** null = sem limite */
  max: number | null
  full: boolean
}

export interface TeamUsage {
  professionals: LimitUse
  /** logins: membros + convites em aberto */
  access: LimitUse
}

const limitUse = (used: number, max: number | null): LimitUse => ({ used, max, full: max !== null && used >= max })

/** quanto do plano a equipe já usa (R-26) */
export function teamUsage(plan: PlanId, counts: { activeProfessionals: number; members: number; openInvites: number }): TeamUsage {
  const limit = PLAN_LIMITS[plan]
  return {
    professionals: limitUse(counts.activeProfessionals, limit.professionals),
    access: limitUse(counts.members + counts.openInvites, limit.members),
  }
}

/** "2 de 3" ou "2" quando não há limite */
export const usageLabel = (u: LimitUse) => (u.max === null ? String(u.used) : `${u.used} de ${u.max}`)

/** o menor plano em que a equipe cabe, para sugerir a troca quando bate no limite */
export function planForTeam(professionals: number, members: number): PlanId {
  const fits = (id: PlanId) => {
    const l = PLAN_LIMITS[id]
    return (l.professionals === null || professionals <= l.professionals) && (l.members === null || members <= l.members)
  }
  return (['solo', 'studio', 'salao'] as PlanId[]).find(fits) ?? 'salao'
}

/** frase para quando o limite chegou: diz o plano atual e qual libera mais */
export function limitMessage(plan: PlanId, what: 'professionals' | 'access'): string {
  const max = PLAN_LIMITS[plan][what === 'professionals' ? 'professionals' : 'members']
  const next: PlanId = plan === 'solo' ? 'studio' : 'salao'
  if (plan === 'solo') return `O plano Solo é para quem atende sozinha. No ${PLANS.studio.name} cabem até 3 profissionais com login.`
  const noun = what === 'professionals' ? 'profissionais ativas' : 'acessos com login (contando você e os convites em aberto)'
  return `O plano ${PLANS[plan].name} vai até ${max} ${noun}. No ${PLANS[next].name} não há limite.`
}

import { isPlanId, type PlanId } from './plans'

/** plano vindo da landing (?plano=studio): guardado na aba até o fim do questionário, mesmo passando pelo Google */
const PLAN_KEY = 'ikizy:plano'
export function rememberPlan(value: string | null) {
  if (!isPlanId(value)) return
  try {
    sessionStorage.setItem(PLAN_KEY, value)
  } catch {
    // navegação privada: segue com a sugestão pela equipe
  }
}
export function rememberedPlan(): PlanId | null {
  try {
    const value = sessionStorage.getItem(PLAN_KEY)
    return isPlanId(value) ? value : null
  } catch {
    return null
  }
}

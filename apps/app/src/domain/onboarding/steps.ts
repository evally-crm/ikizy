/**
 * Cadastro do negócio: uma pergunta por tela. A ordem das perguntas e quando cada uma está respondida.
 * Os textos de erro saem daqui para a tela só mostrar.
 */

export type StepId = 'voce' | 'nome' | 'areas' | 'equipe' | 'horario' | 'servicos'

/** "voce" só aparece quando a conta veio sem nome (cadastro antigo); o Google e o cadastro novo já trazem */
export const STEP_ORDER: StepId[] = ['voce', 'nome', 'areas', 'equipe', 'horario', 'servicos']

export type Team = 'solo' | 'equipe'

export interface OnboardingAnswers {
  ownerName: string
  name: string
  slug: string
  /** o link já foi conferido no banco e está em uso por outro negócio */
  slugTaken: boolean
  segments: string[]
  otherLabel: string
  team: Team | null
  days: number[]
  start: number
  end: number
  serviceCount: number
}

export const isStepId = (v: unknown): v is StepId => typeof v === 'string' && (STEP_ORDER as string[]).includes(v)

/** perguntas desta pessoa, em ordem */
export const stepsFor = (needsName: boolean): StepId[] => STEP_ORDER.filter((s) => needsName || s !== 'voce')

/** a anterior e a próxima pergunta (null nas pontas) */
export function neighbors(steps: StepId[], step: StepId): { prev: StepId | null; next: StepId | null } {
  const i = steps.indexOf(step)
  return { prev: i > 0 ? steps[i - 1] : null, next: i >= 0 && i < steps.length - 1 ? steps[i + 1] : null }
}

export const RESERVED_HINT = 'Esse link é reservado. Escolha outro.'

/** o que falta no link do site, ou null se está bom */
export function slugProblem(slug: string, reserved: boolean, taken: boolean): string | null {
  if (slug.length < 3) return 'O link precisa ter pelo menos 3 letras.'
  if (reserved) return RESERVED_HINT
  if (taken) return 'Esse link já está em uso. Troque por outro.'
  return null
}

/**
 * o que impede de seguir nesta pergunta (null = pode seguir).
 * `reserved` vem de fora porque a lista de links reservados mora em lib/slug.
 */
export function stepProblem(step: StepId, a: OnboardingAnswers, reserved: boolean): string | null {
  switch (step) {
    case 'voce':
      return a.ownerName.trim().length < 2 ? 'Conte como você se chama.' : null
    case 'nome':
      if (a.name.trim().length < 2) return 'Dê um nome ao seu negócio.'
      return slugProblem(a.slug, reserved, a.slugTaken)
    case 'areas':
      if (a.segments.length === 0) return 'Escolha pelo menos uma área.'
      if (a.segments.includes('outro') && a.otherLabel.trim().length < 2) return 'Conte qual é a outra área.'
      return null
    case 'equipe':
      return a.team ? null : 'Escolha uma das duas opções.'
    case 'horario':
      if (a.days.length === 0) return 'Marque pelo menos um dia.'
      if (a.end <= a.start) return 'O horário de fechar precisa ser depois do de abrir.'
      return null
    case 'servicos':
      return a.serviceCount === 0 ? 'Deixe pelo menos um serviço. Você ajusta tudo depois.' : null
  }
}

/** primeira pergunta ainda sem resposta: quem abre um passo adiante pelo endereço volta para ela */
export function firstOpenStep(steps: StepId[], a: OnboardingAnswers, reserved: boolean): StepId | null {
  return steps.find((s) => stepProblem(s, a, reserved) !== null) ?? null
}

/** até onde a pessoa pode ir: a pergunta pedida, ou a primeira ainda sem resposta antes dela */
export function reachableStep(steps: StepId[], wanted: StepId, a: OnboardingAnswers, reserved: boolean): StepId {
  const target = steps.includes(wanted) ? wanted : steps[0]
  const open = firstOpenStep(steps.slice(0, steps.indexOf(target)), a, reserved)
  return open ?? target
}

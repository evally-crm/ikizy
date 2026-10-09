/**
 * Comissão da equipe: regras em % ou valor fixo por atendimento. Usado no financeiro (e testado em
 * api/_lib/commission.test.ts), por isso não importa nada do React.
 *
 * Vale a regra mais específica para cada atendimento:
 *   profissional + serviço  >  só o serviço  >  só a profissional  >  padrão do salão
 */
import type { PlanId } from './plans'

export type CommissionKind = 'percent' | 'fixed'
/** price = sobre o valor cobrado; price_minus_card_fee = desconta antes a taxa da maquininha (crédito/débito) */
export type CommissionBase = 'price' | 'price_minus_card_fee'

export interface CommissionRule {
  professionalId: string | null
  serviceId: string | null
  kind: CommissionKind
  value: number
}

export interface CommissionSettings {
  enabled: boolean
  base: CommissionBase
}

export interface CommissionAppointment {
  professionalId: string
  serviceId: string | null
  price: number
  paymentMethod?: string | null
}

export interface CommissionLine {
  professionalId: string
  qty: number
  total: number
}

export const DEFAULT_COMMISSION: CommissionSettings = { enabled: false, base: 'price' }

/** comissão é recurso de equipe: não existe no Solo */
export const planHasCommission = (plan: PlanId | undefined) => plan !== undefined && plan !== 'solo'

const CARD_METHODS = new Set(['credito', 'debito'])
const cents = (n: number) => Math.round(n * 100) / 100

export function findRule(rules: CommissionRule[], professionalId: string, serviceId: string | null): CommissionRule | null {
  const match = (p: string | null, s: string | null) => rules.find((r) => r.professionalId === p && r.serviceId === s) ?? null
  return (
    (serviceId ? match(professionalId, serviceId) : null) ??
    (serviceId ? match(null, serviceId) : null) ??
    match(professionalId, null) ??
    match(null, null)
  )
}

/** comissão de um atendimento concluído, em reais (centavos arredondados) */
export function commissionFor(appt: CommissionAppointment, rules: CommissionRule[], settings: CommissionSettings, cardFeePct: number): number {
  if (!settings.enabled) return 0
  const rule = findRule(rules, appt.professionalId, appt.serviceId)
  if (!rule || rule.value <= 0) return 0
  if (rule.kind === 'fixed') return cents(rule.value)
  const fee = settings.base === 'price_minus_card_fee' && appt.paymentMethod && CARD_METHODS.has(appt.paymentMethod) ? appt.price * (cardFeePct / 100) : 0
  return cents(Math.max(appt.price - fee, 0) * (rule.value / 100))
}

/** soma por profissional; só aparece quem tem comissão no período */
export function commissionsByProfessional(
  appts: CommissionAppointment[],
  rules: CommissionRule[],
  settings: CommissionSettings,
  cardFeePct: number,
): CommissionLine[] {
  if (!settings.enabled) return []
  const byPro = new Map<string, CommissionLine>()
  for (const a of appts) {
    const value = commissionFor(a, rules, settings, cardFeePct)
    if (value <= 0) continue
    const line = byPro.get(a.professionalId) ?? { professionalId: a.professionalId, qty: 0, total: 0 }
    line.qty += 1
    line.total = cents(line.total + value)
    byPro.set(a.professionalId, line)
  }
  return [...byPro.values()].sort((a, b) => b.total - a.total)
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "40%" ou "R$ 15,00 por atendimento" */
export const describeRule = (r: Pick<CommissionRule, 'kind' | 'value'>) =>
  r.kind === 'percent' ? `${String(r.value).replace('.', ',')}%` : `${brl.format(r.value)} por atendimento`

/** valida o que a dona digitou; devolve a mensagem de erro ou null */
export function ruleProblem(r: Pick<CommissionRule, 'kind' | 'value'>): string | null {
  if (!Number.isFinite(r.value) || r.value < 0) return 'Use um valor positivo.'
  if (r.kind === 'percent' && r.value > 100) return 'A porcentagem vai até 100%.'
  if (r.kind === 'fixed' && r.value > 99999) return 'Valor alto demais.'
  return null
}

import { neon } from './neon'
import type { BillingMethod, PixMonths, PlanId } from './plans'

/** erro devolvido pelas funções de cobrança, com um código estável para a tela decidir o que fazer */
export class BillingError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** POST autenticado para as funções de servidor (/api/...), com erros já em português */
export async function post<T>(path: string, body: unknown): Promise<T> {
  const { data } = (await neon?.auth.getSession()) ?? { data: { session: null } }
  const token = data.session?.access_token
  if (!token) throw new BillingError('unauthenticated', 'Entre na sua conta para continuar.')

  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new BillingError('network', 'Sem conexão. Verifique sua internet e tente de novo.')
  }
  const payload = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
  if (!res.ok) {
    // no ambiente local as funções de servidor não existem (/api devolve a própria página)
    if (res.status === 404 || res.status === 405) {
      throw new BillingError('unavailable', 'Esta função não está disponível neste ambiente.')
    }
    throw new BillingError(payload?.error ?? 'error', payload?.message ?? 'Não foi possível continuar agora. Tente novamente.')
  }
  return payload as T
}

/** abre o Checkout do Stripe (cartão = assinatura mensal; Pix = pagamento adiantado de N meses) */
export async function startCheckout(plan: PlanId, method: BillingMethod, months: PixMonths): Promise<void> {
  const { url } = await post<{ url: string }>('/api/billing/checkout', { plan, method, months })
  window.location.assign(url)
}

/** abre o portal do Stripe: trocar cartão, ver faturas, mudar de plano ou cancelar */
export async function openPortal(): Promise<void> {
  const { url } = await post<{ url: string }>('/api/billing/portal', {})
  window.location.assign(url)
}

/** troca o plano durante o teste grátis, sem pagar (só a dona e só antes de assinar; o banco confere tudo) */
export async function switchTrialPlan(plan: PlanId): Promise<void> {
  if (!neon) throw new BillingError('unavailable', 'A troca de plano não está disponível neste ambiente.')
  const { error } = await neon.rpc('set_trial_plan', { p_plan: plan })
  if (!error) return
  const hint = (error as { hint?: string }).hint
  if (hint === 'plan_professional_limit') {
    throw new BillingError('limit', 'Você tem mais profissionais ativas do que esse plano permite. Desative algumas antes de trocar.')
  }
  if (hint === 'not_in_trial') throw new BillingError('not_in_trial', 'A troca grátis só vale durante o teste. Escolha uma forma de pagamento.')
  throw new BillingError('error', 'Não foi possível trocar o plano agora. Tente novamente.')
}

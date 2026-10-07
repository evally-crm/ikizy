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

async function post<T>(path: string, body: unknown): Promise<T> {
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
      throw new BillingError('unavailable', 'O pagamento não está disponível neste ambiente.')
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

import { neon } from './neon'
import { track } from './analytics'
import type { BillingMethod, PixMonths, PlanId } from './plans'

/** erro devolvido pelas funções de cobrança, com um código estável para a tela decidir o que fazer */
export class BillingError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** envia o pedido com o token de quem está logada; devolve a resposta crua (a de erro já vira BillingError) */
async function send(path: string, body: unknown): Promise<Response> {
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
  if (!res.ok) {
    // no ambiente local as funções de servidor não existem (/api devolve a própria página)
    if (res.status === 404 || res.status === 405) {
      throw new BillingError('unavailable', 'Isso não está disponível neste ambiente.')
    }
    const payload = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
    throw new BillingError(payload?.error ?? 'error', payload?.message ?? 'Não foi possível continuar agora. Tente novamente.')
  }
  return res
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await send(path, body)
  return (await res.json().catch(() => null)) as T
}

/** pede um arquivo (ex.: o ZIP com os dados): devolve o conteúdo e o nome sugerido pelo servidor */
export async function postFile(path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
  const res = await send(path, body)
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1]
  return { blob: await res.blob(), filename: name ?? 'dados.zip' }
}

/** abre o Checkout do Stripe (cartão = assinatura mensal; Pix = pagamento adiantado de N meses); `from` decide para onde o Stripe devolve */
export async function startCheckout(
  plan: PlanId,
  method: BillingMethod,
  months: PixMonths,
  from: 'onboarding' | 'assinatura' = 'assinatura',
): Promise<void> {
  const { url } = await post<{ url: string }>('/api/billing/checkout', { plan, method, months, from })
  window.location.assign(url)
}

/** troca o plano de quem já paga no cartão: subir cobra a diferença agora; descer vale na próxima cobrança */
export async function changePlan(plan: PlanId): Promise<{ upgrade: boolean }> {
  return post<{ upgrade: boolean }>('/api/billing/change-plan', { plan })
}

/** abre o portal do Stripe: trocar cartão, ver faturas ou cancelar (trocar de plano é pelo app) */
export async function openPortal(): Promise<void> {
  const { url } = await post<{ url: string }>('/api/billing/portal', {})
  window.location.assign(url)
}

/** teste sem cartão: grava o plano escolhido no cadastro; o pagamento vem por Pix quando o teste acabar */
export async function chooseTrialPlan(plan: PlanId): Promise<void> {
  if (!neon) return
  const { error } = await neon.rpc('choose_trial_plan', { p_plan: plan })
  if (error) throw new BillingError('choose_failed', 'Não foi possível salvar o plano agora. Tente novamente.')
  track('plano_escolhido', { plano: plan })
}

const synced = new Set<string>()

/** guarda no servidor o e-mail da dona para os avisos de cobrança; uma vez por negócio e por visita, sem fazer barulho se falhar */
export async function syncNotifyEmail(salonId: string): Promise<void> {
  if (synced.has(salonId)) return
  synced.add(salonId)
  try {
    await post('/api/account/sync-email', {})
  } catch {
    synced.delete(salonId)
  }
}

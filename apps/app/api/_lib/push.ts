import { HttpError } from './billing.js'
import { reportError } from './monitoring.js'
import { whenBR } from './notify.js'

/**
 * avisos no aparelho (Web Push) de pedido novo pelo site. A dona, a gerente e a recepção que ligaram o aviso recebem na hora,
 * mesmo com o app fechado. É um extra em cima do e-mail: se falhar, o pedido já está gravado e o e-mail já saiu.
 *
 * Segurança: o servidor faz um POST para o endereço que o navegador entrega, então só aceitamos os serviços de push dos
 * navegadores (lista fechada), nunca um endereço qualquer, para ninguém usar o servidor para chamar a rede interna.
 */

export interface PushSubscriptionInput {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface StoredSubscription extends PushSubscriptionInput {
  userId: string
}

export interface PushDb {
  /** negócio pelo endereço do site */
  salonIdBySlug(slug: string): Promise<string | null>
  /** o perfil da pessoa no negócio (só quem trata pedidos pode ligar o aviso) */
  roleOf(userId: string, salonId: string): Promise<string | null>
  save(userId: string, salonId: string, sub: PushSubscriptionInput, userAgent: string | null): Promise<void>
  /** desliga o aviso desse aparelho (só se for da própria pessoa) */
  remove(userId: string, endpoint: string): Promise<void>
  /** os aparelhos de quem trata pedidos no negócio (dona, gerente e recepção) */
  listForSalon(salonId: string): Promise<StoredSubscription[]>
  /** aparelho que o serviço de push disse que não existe mais */
  drop(endpoint: string): Promise<void>
  /** pedidos do site esperando resposta (vira o número no ícone do app) */
  pendingCount?(salonId: string): Promise<number>
}

/** quem pode ligar o aviso de pedido novo */
export const PUSH_ROLES = ['owner', 'manager', 'reception']

export interface PushPayload {
  title: string
  body: string
  /** caminho dentro do app para abrir ao tocar */
  url: string
  /** a mesma etiqueta substitui o aviso anterior */
  tag: string
  /** número no ícone do app (pedidos esperando resposta) */
  badge?: number
}

/** envia um aviso; devolve o código HTTP do serviço de push (404 e 410 = aparelho que saiu) */
export type PushSender = (sub: PushSubscriptionInput, payload: PushPayload) => Promise<{ status: number }>

/** serviços de push dos navegadores (Chrome/Edge/Opera, Firefox, Safari/iOS, Windows) */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.push\.apple\.com$/, /^[a-z0-9.-]+\.notify\.windows\.com$/, /^push\.services\.mozilla\.com$/]
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/

const bad = (message: string) => new HttpError(400, 'invalid_input', message)

/** confere o que o navegador entregou ao ligar o aviso; recusa endereço fora da lista e chaves que não parecem chaves */
export function parseSubscription(value: unknown): PushSubscriptionInput {
  const v = (value ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  if (typeof v.endpoint !== 'string' || v.endpoint.length > 1000) throw bad('Aparelho inválido.')
  let url: URL
  try {
    url = new URL(v.endpoint)
  } catch {
    throw bad('Aparelho inválido.')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !PUSH_HOSTS.some((h) => h.test(url.hostname))) {
    throw bad('Este navegador usa um serviço de avisos que o IKIZY não aceita.')
  }
  const p256dh = v.keys?.p256dh
  const auth = v.keys?.auth
  // chave pública P-256 (65 bytes) e segredo de autenticação (16 bytes), em base64 seguro para URL
  if (typeof p256dh !== 'string' || !B64URL.test(p256dh) || p256dh.length < 80 || p256dh.length > 100) throw bad('Aparelho inválido.')
  if (typeof auth !== 'string' || !B64URL.test(auth) || auth.length < 20 || auth.length > 30) throw bad('Aparelho inválido.')
  return { endpoint: v.endpoint, keys: { p256dh, auth } }
}

/** liga o aviso neste aparelho (só quem trata pedidos) */
export async function subscribe(db: PushDb, user: { id: string }, salonId: string, body: unknown, userAgent: string | null): Promise<{ ok: true }> {
  const sub = parseSubscription((body as { subscription?: unknown } | null)?.subscription)
  const role = await db.roleOf(user.id, salonId)
  if (!role || !PUSH_ROLES.includes(role)) throw new HttpError(403, 'forbidden', 'Seu perfil não recebe avisos de pedido.')
  await db.save(user.id, salonId, sub, userAgent?.slice(0, 300) ?? null)
  return { ok: true }
}

/** desliga o aviso neste aparelho */
export async function unsubscribe(db: PushDb, user: { id: string }, body: unknown): Promise<{ ok: true }> {
  const endpoint = (body as { endpoint?: unknown } | null)?.endpoint
  if (typeof endpoint !== 'string' || endpoint.length > 1000) throw bad('Aparelho inválido.')
  await db.remove(user.id, endpoint)
  return { ok: true }
}

export interface NewRequestInfo {
  id: string
  startsAt: string
  service: string
  clientName: string
}

/** o texto do aviso de pedido novo; o nome da cliente vai criptografado de ponta a ponta até o aparelho */
export function newRequestPayload(r: NewRequestInfo): PushPayload {
  return {
    title: 'Novo pedido pelo site',
    body: `${r.clientName} pediu ${r.service} · ${whenBR(r.startsAt)}`,
    url: `/dashboard/agenda?pedido=${encodeURIComponent(r.id)}`,
    tag: `request:${r.id}`,
  }
}

/** teto de tempo para o aviso não segurar a resposta da cliente que acabou de pedir o horário */
const TIMEOUT_MS = 4000

/** avisa os aparelhos de quem trata pedidos; apaga os que o serviço de push diz que saíram; nunca lança erro */
export async function pushNewRequest(deps: { db: PushDb; send: PushSender }, slug: string, r: NewRequestInfo): Promise<{ sent: number; dropped: number }> {
  const out = { sent: 0, dropped: 0 }
  try {
    const salonId = await deps.db.salonIdBySlug(slug)
    if (!salonId) return out
    const subs = await deps.db.listForSalon(salonId)
    if (!subs.length) return out
    const payload = newRequestPayload(r)
    const pending = await deps.db.pendingCount?.(salonId).catch(() => undefined)
    if (typeof pending === 'number' && pending > 0) payload.badge = pending
    await Promise.race([
      Promise.all(
        subs.map(async (s) => {
          try {
            const { status } = await deps.send(s, payload)
            if (status === 404 || status === 410) {
              await deps.db.drop(s.endpoint)
              out.dropped++
            } else if (status >= 200 && status < 300) out.sent++
          } catch (error) {
            // um aparelho com problema não impede os outros
            reportError(error, 'aviso push')
          }
        }),
      ),
      new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS)),
    ])
  } catch (error) {
    reportError(error, `aviso push do pedido ${slug}`)
  }
  return out
}

/**
 * repasse do login: o navegador fala com app.ikizy.com/api/auth/... e o servidor repassa ao Neon Auth.
 *
 * Por quê: o login do Neon fica em outro domínio, então o cookie da sessão era "de terceiros" e o Safari do iPhone
 * (bloqueio de rastreamento) não o enviava de volta: depois de entrar com o Google a pessoa caía de novo na tela de login.
 * Passando pelo nosso próprio domínio, o cookie é do mesmo site e o Safari aceita.
 *
 * O repasse não guarda nada, não coloca nada em cache e só encaminha o que o login precisa.
 */

const FORWARD_REQUEST = ['content-type', 'cookie', 'authorization', 'user-agent', 'accept', 'accept-language']
const MAX_BODY = 256 * 1024
const TIMEOUT_MS = 15_000

export interface AuthProxyOptions {
  /** endereço do Neon Auth (NEON_AUTH_BASE_URL) */
  base: string
  fetchImpl?: typeof fetch
}

const noStore = { 'cache-control': 'no-store' }

/** monta o endereço de destino; null se o caminho tentar sair da API do login */
export function targetUrl(base: string, path: string, search: string): URL | null {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0')) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return null
  }
  if (decoded.split('/').some((p) => p === '..' || p === '.')) return null
  const root = new URL(base.replace(/\/$/, '') + '/')
  const url = new URL(path.replace(/^\/+/, ''), root)
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) return null
  url.search = search
  return url
}

export async function proxyAuth(request: Request, opts: AuthProxyOptions): Promise<Response> {
  const incoming = new URL(request.url)
  const path = incoming.searchParams.get('p') ?? ''
  incoming.searchParams.delete('p')
  const search = incoming.searchParams.toString()
  const target = targetUrl(opts.base, path, search ? `?${search}` : '')
  if (!target) return Response.json({ error: 'not_found', message: 'Endereço inválido.' }, { status: 404, headers: noStore })
  if (!['GET', 'POST'].includes(request.method)) return Response.json({ error: 'method', message: 'Método não aceito.' }, { status: 405, headers: noStore })

  const headers = new Headers()
  for (const name of FORWARD_REQUEST) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  // o Neon confere de onde vem o pedido: é o nosso próprio endereço (cadastrado nos domínios confiáveis)
  headers.set('origin', incoming.origin)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
  if (ip) headers.set('x-forwarded-for', ip)

  let body: ArrayBuffer | undefined
  if (request.method === 'POST') {
    body = await request.arrayBuffer()
    if (body.byteLength > MAX_BODY) return Response.json({ error: 'too_large', message: 'Pedido grande demais.' }, { status: 413, headers: noStore })
  }

  const doFetch = opts.fetchImpl ?? fetch
  let upstream: Response
  try {
    upstream = await doFetch(target, { method: request.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    return Response.json({ error: 'upstream', message: 'O login não respondeu. Tente novamente.' }, { status: 502, headers: noStore })
  }

  const out = new Headers(noStore)
  for (const name of ['content-type', 'location', 'set-auth-jwt', 'access-control-expose-headers']) {
    const value = upstream.headers.get(name)
    if (value) out.set(name, value)
  }
  // vários Set-Cookie precisam ir um por um
  for (const cookie of upstream.headers.getSetCookie()) out.append('set-cookie', cookie)
  // o corpo já vem decodificado: não repassar o tamanho nem a compressão do original
  return new Response(upstream.status === 204 || upstream.status === 304 ? null : await upstream.arrayBuffer(), { status: upstream.status, headers: out })
}

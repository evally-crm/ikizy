import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { firstPartyCookie, proxyAuth, targetUrl } from './authProxy.js'

const BASE = 'https://ep-x.neonauth.sa-east-1.aws.neon.tech/neondb/auth'

describe('targetUrl (não sai da API do login)', () => {
  it('monta o destino com o caminho e os parâmetros', () => {
    assert.equal(targetUrl(BASE, 'sign-in/email', '')?.href, `${BASE}/sign-in/email`)
    assert.equal(targetUrl(BASE, 'get-session', '?neon_auth_session_verifier=abc')?.href, `${BASE}/get-session?neon_auth_session_verifier=abc`)
    assert.equal(targetUrl(BASE + '/', '.well-known/jwks.json', '')?.href, `${BASE}/.well-known/jwks.json`)
  })
  it('recusa caminho que tenta fugir, outro endereço ou truque de barra', () => {
    for (const p of ['', '../x', 'a/../../x', '%2e%2e/x', 'a/%2e%2e/b', '//evil.com/x', 'https://evil.com/x', 'a\\b', '/\\evil.com']) {
      assert.equal(targetUrl(BASE, p, ''), null, p)
    }
  })
})

describe('firstPartyCookie', () => {
  it('tira Partitioned, Domain, SameSite e Path do Neon e deixa um cookie comum do nosso site', () => {
    assert.equal(
      firstPartyCookie('__Secure-neon-auth.session_challenge=abc; Max-Age=600; Domain=x.neon.tech; Path=/neondb/auth; HttpOnly; Secure; SameSite=None; Partitioned'),
      '__Secure-neon-auth.session_challenge=abc; Path=/; SameSite=Lax; Max-Age=600; HttpOnly; Secure',
    )
  })
  it('valor com = e cookie apagado (Max-Age=0) seguem intactos', () => {
    assert.equal(firstPartyCookie('t=a=b==; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'), 't=a=b==; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  })
})

describe('proxyAuth', () => {
  const req = (path: string, init: RequestInit = {}) => new Request(`https://app.ikizy.com/api/auth?p=${path}`, init)

  it('repassa o pedido ao Neon com a origem do app, e devolve todos os cookies e o token', async () => {
    let seen: { url: string; headers: Headers; method: string; body: string } | null = null
    const fetchImpl = (async (url: URL, init: RequestInit) => {
      seen = { url: url.href, headers: new Headers(init.headers), method: init.method!, body: new TextDecoder().decode(init.body as ArrayBuffer) }
      const h = new Headers({ 'content-type': 'application/json', 'set-auth-jwt': 'jwt.jwt.jwt', 'content-encoding': 'gzip', 'content-length': '99' })
      h.append('set-cookie', 'a=1; Path=/; HttpOnly; Secure; SameSite=None')
      h.append('set-cookie', 'b=2; Path=/; HttpOnly; Secure')
      return new Response('{"ok":true}', { status: 200, headers: h })
    }) as unknown as typeof fetch
    const res = await proxyAuth(
      req('sign-in/email', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'c=3', host: 'evil', 'x-forwarded-host': 'evil', 'x-secret': 'x' }, body: '{"email":"a@b.c"}' }),
      { base: BASE, fetchImpl },
    )
    assert.equal(seen!.url, `${BASE}/sign-in/email`)
    assert.equal(seen!.method, 'POST')
    assert.equal(seen!.body, '{"email":"a@b.c"}')
    assert.equal(seen!.headers.get('origin'), 'https://app.ikizy.com')
    assert.equal(seen!.headers.get('cookie'), 'c=3')
    assert.equal(seen!.headers.get('host'), null)
    assert.equal(seen!.headers.get('x-forwarded-host'), null)
    assert.equal(seen!.headers.get('x-secret'), null)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('set-auth-jwt'), 'jwt.jwt.jwt')
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.equal(res.headers.get('content-encoding'), null)
    assert.equal(res.headers.get('content-length'), null)
    assert.deepEqual(res.headers.getSetCookie(), ['a=1; Path=/; SameSite=Lax; HttpOnly; Secure', 'b=2; Path=/; SameSite=Lax; HttpOnly; Secure'])
    assert.deepEqual(await res.json(), { ok: true })
  })

  it('o parâmetro p não vai para o Neon, os outros vão (verificador do Google)', async () => {
    let url = ''
    const fetchImpl = (async (u: URL) => {
      url = u.href
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    await proxyAuth(new Request('https://app.ikizy.com/api/auth?p=get-session&neon_auth_session_verifier=zzz'), { base: BASE, fetchImpl })
    assert.equal(url, `${BASE}/get-session?neon_auth_session_verifier=zzz`)
  })

  it('não segue redirecionamento: devolve o Location para o navegador', async () => {
    const fetchImpl = (async (_u: URL, init: RequestInit) => {
      assert.equal(init.redirect, 'manual')
      return new Response(null, { status: 302, headers: { location: 'https://app.ikizy.com/dashboard?x=1' } })
    }) as unknown as typeof fetch
    const res = await proxyAuth(req('callback/google'), { base: BASE, fetchImpl })
    assert.equal(res.status, 302)
    assert.equal(res.headers.get('location'), 'https://app.ikizy.com/dashboard?x=1')
  })

  it('recusa caminho inválido, método diferente e corpo enorme; falha do Neon vira 502', async () => {
    const never = (async () => {
      throw new Error('não podia chamar')
    }) as unknown as typeof fetch
    assert.equal((await proxyAuth(req('..%2Fx'), { base: BASE, fetchImpl: never })).status, 404)
    assert.equal((await proxyAuth(req('sign-out', { method: 'DELETE' }), { base: BASE, fetchImpl: never })).status, 405)
    assert.equal((await proxyAuth(req('sign-in/email', { method: 'POST', body: new Uint8Array(300 * 1024) }), { base: BASE, fetchImpl: never })).status, 413)
    assert.equal((await proxyAuth(req('get-session'), { base: BASE, fetchImpl: never })).status, 502)
  })
})

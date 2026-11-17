// Teste de ponta a ponta das rotas /api com login de verdade, na branch "dev" do Neon (npm run test:e2e-dev).
// Cadastra uma dona nova, chama os handlers como a Vercel chamaria e apaga tudo no fim. Aborta se o banco não for a dev.
import { neon } from '@neondatabase/serverless'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DEV = 'ep-old-dream-b6e5t7dn'
const PROD = 'ep-twilight-heart-b66hba33'
const root = resolve(import.meta.dirname, '../../..')
const file = join(root, '.env.dev.local')
const read = (k: string) => readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith(k + '='))!.slice(k.length + 1).trim().replace(/^["']|["']$/g, '')
const url = read('DATABASE_URL')
if (!url.includes(DEV) || url.includes(PROD)) throw new Error('abortado: não é a branch dev')
for (const k of ['DATABASE_URL', 'NEON_AUTH_BASE_URL', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) process.env[k] = read(k)
process.env.ADMIN_EMAILS = 'ninguem@ikizy.test'

const sql = neon(url)
const [who] = await sql`select current_setting('neon.endpoint_id', true) as ep`
if (who.ep !== DEV) throw new Error('abortado: o servidor não é a branch dev')

const account = await import('../api/account.js')
const booking = await import('../api/booking.js')
const site = await import('../api/site.js')

const AUTH = process.env.NEON_AUTH_BASE_URL!.replace(/\/$/, '')
const ORIGIN = 'http://localhost:5173'
const tag = `e2e${Date.now().toString(36)}`
const email = `${tag}@ikizy.test`
const password = `Senha-${tag}-Forte1`
const slug = `${tag}-studio`
const ok = (m: string) => console.log('  ✔', m)

const call = (action: string, token: string | null, body: unknown = {}) =>
  account.POST(
    new Request(`https://app.test/api/account?action=${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
  )
const status = async (r: Response) => ({ status: r.status, body: (r.headers.get('content-type')?.includes('json') ? await r.json() : null) as any })

let userId: string | null = null
let salonId: string | null = null
try {
  console.log('cadastro e login')
  const signUp = await fetch(`${AUTH}/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ name: 'Dona E2E', email, password }),
  })
  assert.equal(signUp.status, 200, 'cadastro: ' + (await signUp.clone().text()))
  userId = ((await signUp.json()) as { user: { id: string } }).user.id
  ok('conta criada na branch dev')

  const wrong = await fetch(`${AUTH}/sign-in/email`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ email, password: 'errada-errada' }) })
  assert.equal(wrong.status, 401)
  ok('senha errada é recusada')

  const signIn = await fetch(`${AUTH}/sign-in/email`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ email, password }) })
  assert.equal(signIn.status, 200)
  const cookie = (signIn.headers.get('set-cookie') ?? '').split(';')[0]
  const tokenRes = await fetch(`${AUTH}/token`, { headers: { origin: ORIGIN, cookie } })
  const token = ((await tokenRes.json()) as { token: string }).token
  assert.ok(token.split('.').length === 3)
  ok('entrou e recebeu o token da sessão')

  console.log('segurança das rotas')
  assert.equal((await status(await call('me', null))).status, 401)
  assert.equal((await status(await call('me', 'lixo.lixo.lixo'))).status, 401)
  assert.equal((await status(await call('nao-existe', token))).status, 404)
  assert.equal((await status(await call('admin-salons', token))).status, 403)
  assert.equal((await status(await call('admin-log', token))).status, 403)
  ok('sem token, token falso, ação inexistente e área do master: tudo recusado')

  const me = await status(await call('me', token))
  assert.equal(me.status, 200)
  assert.equal(me.body.admin, false)
  assert.equal(me.body.deletionAt, null)
  ok('"me": não é master e não tem exclusão agendada')

  console.log('quem ainda não tem negócio')
  assert.equal((await status(await call('export', token))).status, 403)
  assert.equal((await status(await call('push-subscribe', token, {}))).status, 403)
  ok('sem negócio não exporta nem liga aviso')

  console.log('negócio e equipe')
  const s = await sql`insert into public.salons (name, slug) values (${'Estúdio ' + tag}, ${slug}) returning id`
  salonId = s[0].id as string
  await sql`insert into public.members (salon_id, user_id, role) values (${salonId}::uuid, ${userId}::uuid, 'owner')`
  await sql`insert into public.subscriptions (salon_id, plan, status, access_until, notify_email)
    values (${salonId}::uuid, 'solo', 'trialing', now() + interval '20 days', ${email})`
  await sql`insert into public.clients (salon_id, name, phone) values (${salonId}::uuid, 'Ana', '11999990000')`

  console.log('avisos no aparelho')
  const cfg = await status(await call('push-config', token))
  assert.equal(cfg.body.publicKey, process.env.VAPID_PUBLIC_KEY)
  ok('o servidor entrega a chave pública')
  const bad = await status(await call('push-subscribe', token, { subscription: { endpoint: 'https://169.254.169.254/x', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } } }))
  assert.equal(bad.status, 400)
  ok('endereço fora da lista (rede interna) é recusado')
  const endpoint = `https://fcm.googleapis.com/fcm/send/${tag}:APA91bExemplo`
  const good = await status(await call('push-subscribe', token, { subscription: { endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } } }))
  assert.equal(good.status, 200)
  assert.equal(Number((await sql`select count(*)::int n from public.push_subscriptions where salon_id = ${salonId}::uuid`)[0].n), 1)
  ok('aparelho válido é gravado')
  assert.equal((await status(await call('push-unsubscribe', token, { endpoint }))).status, 200)
  assert.equal(Number((await sql`select count(*)::int n from public.push_subscriptions where salon_id = ${salonId}::uuid`)[0].n), 0)
  ok('desligar remove o aparelho')

  console.log('página pública e pedido do site')
  await sql`insert into public.site_settings (salon_id, published) values (${salonId}::uuid, true) on conflict (salon_id) do update set published = true`
  const page = await site.GET(new Request(`https://app.test/api/site?slug=${slug}`))
  assert.equal(page.status, 200)
  assert.match(await page.text(), new RegExp(`Estúdio ${tag}`))
  ok('a página pública do negócio abre')
  assert.equal((await site.GET(new Request('https://app.test/api/site?slug=nao-existe-mesmo'))).status, 404)
  ok('endereço que não existe dá 404')
  const noConsent = await booking.POST(
    new Request('https://app.test/api/booking', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ slug, service: 'Corte', date: '2030-01-01', minute: 600, name: 'Bia', phone: '11988887777', consent: false }),
    }),
  )
  assert.equal(noConsent.status, 400)
  ok('pedido sem autorizar o uso dos dados é recusado')
  const robot = await booking.POST(
    new Request('https://app.test/api/booking', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ slug, service: 'Corte', date: '2030-01-01', minute: 600, name: 'Robô', phone: '11988887777', consent: true, website: 'http://spam' }),
    }),
  )
  assert.equal(Number((await sql`select count(*)::int n from public.appointments where salon_id = ${salonId}::uuid`)[0].n), 0)
  void robot
  ok('robô (campo isca preenchido) não grava nada')

  console.log('exportar os dados')
  const exp = await call('export', token)
  assert.equal(exp.status, 200)
  assert.match(exp.headers.get('content-type') ?? '', /zip/)
  const zip = Buffer.from(await exp.arrayBuffer())
  assert.equal(zip.subarray(0, 2).toString(), 'PK')
  assert.ok(zip.includes(Buffer.from('clientes')))
  ok(`ZIP válido (${zip.length} bytes) com a planilha de clientes`)

  console.log('exclusão da conta')
  const wrongName = await status(await call('delete', token, { confirmation: 'outro nome' }))
  assert.equal(wrongName.status, 400)
  assert.ok(await sql`select 1 from public.salons where id = ${salonId}::uuid`.then((r) => r.length === 1))
  ok('nome errado não apaga nada')
  const del = await status(await call('delete', token, { confirmation: `Estúdio ${tag}`, reason: 'testing' }))
  assert.equal(del.status, 200)
  assert.ok(del.body.scheduled)
  const after = await status(await call('me', token))
  assert.ok(after.body.deletionAt)
  assert.equal((await sql`select 1 from public.salons where id = ${salonId}::uuid`).length, 1)
  ok('pedido agendado para daqui a 7 dias; negócio e dados continuam')
  const back = await status(await call('cancel-delete', token))
  assert.equal(back.status, 200)
  assert.equal((await status(await call('me', token))).body.deletionAt, null)
  ok('desistir cancela o agendamento')

  console.log('limite de uso por pessoa')
  let limited = 0
  for (let i = 0; i < 70; i++) if ((await call('summary', token)).status === 429) limited++
  assert.ok(limited > 0, 'o limite de 60/min deveria ter barrado')
  ok(`excesso de chamadas é barrado (${limited} recusadas com 429)`)
} finally {
  // limpeza: apaga o negócio (cascata) e o login criado
  if (salonId) await sql`delete from public.salons where id = ${salonId}::uuid`.catch(() => {})
  if (userId) {
    await sql`delete from public.audit_log where actor_user_id = ${userId}::uuid`.catch(() => {})
    await sql`delete from neon_auth."user" where id = ${userId}::uuid`.catch(() => {})
  }
  await sql`delete from public.rate_limits where key like ${'%' + (userId ?? 'x') + '%'}`.catch(() => {})
}
console.log('\nTUDO CERTO')

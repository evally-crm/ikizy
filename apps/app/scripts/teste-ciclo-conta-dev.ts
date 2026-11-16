// Teste de integração do ciclo de vida da conta (exclusão com espera, retenção, logins largados, registro do master), com Postgres de verdade.
// Roda SÓ na branch "dev" do Neon (npm run test:dev-db) e apaga o que cria; aborta se o banco não for a dev.
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
process.env.DATABASE_URL = url

const sql = neon(url)
const [who] = await sql`select current_setting('neon.endpoint_id', true) as ep`
if (who.ep !== DEV) throw new Error('abortado: o servidor não é a branch dev')

const { createAccountDb, createHousekeepingDb } = await import('../api/_lib/runtime.js')
const { deleteAccount, cancelDeletion, deletionStatus, adminDeleteSalon, adminAuditLog, adminListSalons, parseAdminEmails } = await import('../api/_lib/account.js')
const { runHousekeeping } = await import('../api/_lib/housekeeping.js')

const db = createAccountDb()
const hk = createHousekeepingDb()
const sent: string[] = []
const stripeCalls: string[] = []
const deps = {
  db,
  hk,
  protectEmails: ['master-int@ikizy.test'],
  deleteCustomer: async (id: string) => void stripeCalls.push(`del:${id}`),
  setCancelAtPeriodEnd: async (id: string, v: boolean) => void stripeCalls.push(`cae:${id}:${v}`),
  deletePhotos: async () => {},
  send: async (m: { to: string; subject: string }) => void sent.push(`${m.to}|${m.subject}`),
  appUrl: 'https://app.ikizy.com',
}

const tag = `int${Date.now().toString(36)}`
const ids = { users: [] as string[], salons: [] as string[] }
const day = 24 * 3600 * 1000

async function user(name: string, email: string, verified: boolean, ageDays = 0) {
  const r = await sql`insert into neon_auth."user" (name, email, "emailVerified", "createdAt", "updatedAt")
    values (${name}, ${email}, ${verified}, now() - ${ageDays} * interval '1 day', now()) returning id`
  ids.users.push(r[0].id as string)
  return r[0].id as string
}
async function salon(slug: string, owner: string, opts: { status?: string; accessDays?: number; email?: string | null; card?: boolean; seed?: boolean } = {}) {
  const s = await sql`insert into public.salons (name, slug) values (${'Negócio ' + slug}, ${slug}) returning id`
  const id = s[0].id as string
  ids.salons.push(id)
  await sql`insert into public.members (salon_id, user_id, role) values (${id}::uuid, ${owner}::uuid, 'owner')`
  await sql`insert into public.subscriptions (salon_id, plan, status, access_until, billing_method, stripe_customer_id, stripe_subscription_id, notify_email)
    values (${id}::uuid, 'solo', ${opts.status ?? 'trialing'}::public.billing_status, now() + ${opts.accessDays ?? 20} * interval '1 day',
            ${opts.card ? 'card' : null}, ${'cus_' + slug}, ${opts.card ? 'sub_' + slug : null}, ${opts.email === undefined ? slug + '@int.test' : opts.email})`
  if (opts.seed) {
    const p = await sql`insert into public.professionals (salon_id, name) values (${id}::uuid, 'Pro') returning id`
    const c = await sql`insert into public.clients (salon_id, name) values (${id}::uuid, 'Cliente') returning id`
    await sql`insert into public.appointments (salon_id, client_id, professional_id, service_name, starts_at, duration)
      values (${id}::uuid, ${c[0].id}::uuid, ${p[0].id}::uuid, 'Corte', now() + interval '1 day', 60)`
  }
  return id
}
const count = async (t: string, col: string, v: string) => Number((await sql.query(`select count(*)::int n from ${t} where ${col} = $1`, [v]))[0].n)
const exists = async (id: string) => (await count('public.salons', 'id', id)) === 1
const userExists = async (id: string) => (await count('neon_auth."user"', 'id', id)) === 1
const ok = (m: string) => console.log('  ✔', m)

try {
  console.log('migration idempotente')
  const migration = readFileSync(join(root, 'neon/migrations/20261116000000_account_lifecycle.sql'), 'utf8')
  const pool = new (await import('@neondatabase/serverless')).Pool({ connectionString: read('DATABASE_URL_UNPOOLED') })
  await pool.query(migration)
  await pool.end()
  ok('rodar de novo não dá erro')

  console.log('colunas protegidas (role authenticated)')
  const probe = await user('Probe', `${tag}-probe@int.test`, true)
  const sProbe = await salon(`${tag}-probe`, probe)
  await sql.transaction([sql`set local role authenticated`, sql`update public.salons set name = 'novo nome' where id = ${sProbe}::uuid`]).catch((e: Error) => {
    throw new Error('renomear deveria continuar permitido: ' + e.message)
  })
  ok('authenticated ainda altera o nome')
  await assert.rejects(
    sql.transaction([sql`set local role authenticated`, sql`update public.salons set deletion_scheduled_at = now(), deletion_requested_at = now() where id = ${sProbe}::uuid`]),
    /permission denied/i,
  )
  ok('authenticated NÃO consegue agendar a própria exclusão por fora do servidor')
  await assert.rejects(sql.transaction([sql`set local role authenticated`, sql`select * from public.audit_log`]), /permission denied/i)
  ok('authenticated NÃO lê o audit_log')

  console.log('dona pede a exclusão e desiste')
  const ownerA = await user('Dona A', `${tag}-a@int.test`, true)
  const sA = await salon(`${tag}-a`, ownerA, { status: 'active', card: true, seed: true })
  const out = await deleteAccount(deps, { id: ownerA, email: `${tag}-a@int.test` }, { confirmation: `Negócio ${tag}-a` })
  assert.ok('scheduled' in out)
  assert.ok(await exists(sA) && (await userExists(ownerA)))
  assert.deepEqual(stripeCalls, [`cae:sub_${tag}-a:true`])
  const when = await deletionStatus(db, ownerA)
  assert.ok(when && new Date(when).getTime() - Date.now() > 6.9 * day && new Date(when).getTime() - Date.now() < 7.1 * day)
  ok('agendou para ~7 dias, nada foi apagado, renovação do cartão pausada')
  assert.equal((await adminListSalons({ ...deps }, parseAdminEmails(`${tag}-m@int.test`), { id: await user('M', `${tag}-m@int.test`, true), email: `${tag}-m@int.test` })).salons.find((s) => s.id === sA)?.deletionScheduledAt, when)
  ok('o master vê "exclusão agendada" na lista')
  await cancelDeletion(deps, { id: ownerA, email: `${tag}-a@int.test` })
  assert.equal(await deletionStatus(db, ownerA), null)
  assert.deepEqual(stripeCalls.at(-1), `cae:sub_${tag}-a:false`)
  ok('desistir limpa o agendamento e religa a renovação')

  console.log('limpeza diária apaga a exclusão vencida (com atendimentos)')
  await deleteAccount(deps, { id: ownerA, email: `${tag}-a@int.test` }, { confirmation: `negócio ${tag}-a` })
  await sql`update public.salons set deletion_scheduled_at = now() - interval '1 hour', deletion_requested_at = now() - interval '7 days 1 hour' where id = ${sA}::uuid`
  const r1 = await runHousekeeping(deps)
  assert.ok(r1.purgedRequested >= 1)
  assert.ok(!(await exists(sA)) && !(await userExists(ownerA)))
  assert.equal(await count('public.appointments', 'salon_id', sA), 0)
  assert.equal(await count('public.clients', 'salon_id', sA), 0)
  assert.ok(stripeCalls.includes(`del:cus_${tag}-a`))
  assert.ok(sent.some((s) => s.startsWith(`${tag}-a@int.test|Sua conta do IKIZY foi excluída`)))
  ok('negócio, atendimentos, clientes e login apagados; Stripe e e-mail acionados')

  console.log('retenção de 90 dias')
  const ownerB = await user('Dona B', `${tag}-b@int.test`, true)
  const sB = await salon(`${tag}-b`, ownerB, { status: 'canceled', accessDays: -84 })
  const r2 = await runHousekeeping(deps)
  assert.ok(r2.retentionWarned >= 1 && (await exists(sB)))
  assert.equal(await count('public.email_log', 'key', 'retention-warn:' + sB), 1)
  ok('aos 84 dias: aviso enviado e negócio mantido')
  assert.equal((await runHousekeeping(deps)).retentionWarned, 0)
  ok('o aviso não se repete')
  await sql`update public.subscriptions set access_until = now() - interval '97 days' where salon_id = ${sB}::uuid`
  await runHousekeeping(deps)
  assert.ok(await exists(sB), 'aviso recente não pode permitir apagar')
  ok('com o aviso de hoje, passar dos 90 dias ainda não apaga')
  await sql`update public.email_log set sent_at = now() - interval '8 days' where key = ${'retention-warn:' + sB}`
  const r3 = await runHousekeeping(deps)
  assert.ok(r3.retentionPurged >= 1 && !(await exists(sB)) && !(await userExists(ownerB)))
  ok('aviso com 8 dias e acesso vencido há 97: apagado')
  const ownerC = await user('Dona C', `${tag}-c@int.test`, true)
  const sC = await salon(`${tag}-c`, ownerC, { status: 'active', accessDays: -200 })
  await runHousekeeping(deps)
  assert.ok(await exists(sC))
  ok('assinatura ativa nunca é apagada, mesmo com a data velha')

  console.log('logins largados')
  const oldUnverified = await user('Largado', `${tag}-o1@int.test`, false, 10)
  const newUnverified = await user('Recente', `${tag}-o2@int.test`, false, 1)
  const oldVerifiedNoSalon = await user('Parado', `${tag}-o3@int.test`, true, 100)
  const protectedOld = await user('Master', 'master-int@ikizy.test', true, 400)
  const verifiedRecent = await user('Novo', `${tag}-o4@int.test`, true, 3)
  await runHousekeeping(deps)
  assert.ok(!(await userExists(oldUnverified)) && !(await userExists(oldVerifiedNoSalon)))
  assert.ok((await userExists(newUnverified)) && (await userExists(verifiedRecent)) && (await userExists(protectedOld)))
  ok('apaga não confirmado (>7 dias) e parado (>90); mantém recentes e o e-mail do master')
  assert.ok((await userExists(ownerC)) && (await exists(sC)))
  ok('quem tem negócio nunca é tocado')

  console.log('master apaga na hora, com registro')
  const ownerD = await user('Dona D', `${tag}-d@int.test`, true)
  const sD = await salon(`${tag}-d`, ownerD, { seed: true })
  const masterId = await user('Master', `${tag}-m2@int.test`, true)
  const admins = parseAdminEmails(`${tag}-m2@int.test`)
  await adminDeleteSalon(deps, admins, { id: masterId, email: `${tag}-m2@int.test` }, { salonId: sD, confirmation: `${tag}-d` })
  assert.ok(!(await exists(sD)) && !(await userExists(ownerD)))
  const log = (await adminAuditLog(deps, admins, { id: masterId, email: `${tag}-m2@int.test` })).log
  const mine = log.filter((l) => l.salonSlug?.startsWith(tag))
  assert.ok(mine.some((l) => l.action === 'admin.delete_salon' && l.actorEmail === `${tag}-m2@int.test`))
  assert.ok(mine.some((l) => l.action === 'owner.request_deletion') && mine.some((l) => l.action === 'owner.cancel_deletion') && mine.some((l) => l.action === 'system.purge_salon'))
  ok('apagou tudo e o registro guarda quem, o quê e quando (inclusive pedidos, desistência e limpezas)')
  console.log('\nTUDO CERTO')
} finally {
  // limpa o que o teste criou, mesmo que algo tenha falhado
  await sql`delete from public.salons where slug like ${tag + '%'}`
  await sql`delete from neon_auth."user" where email like ${tag + '%'} or email = 'master-int@ikizy.test'`
  await sql`delete from public.audit_log where salon_slug like ${tag + '%'} or action = 'system.purge_orphan_logins'`
}

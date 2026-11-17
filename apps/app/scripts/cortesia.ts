/**
 * Cortesia: o negócio de uma dona (pelo e-mail do login) fica com acesso sem vencimento e sem cobrança.
 * Usado para a conta do master da IKIZY. Precisa da migration 20261117130000_complimentary.
 *
 *   npm run db:cortesia -- email@x.com                    -> mostra o que muda na PRODUÇÃO (não muda nada)
 *   npm run db:cortesia -- email@x.com --aplicar          -> aplica na PRODUÇÃO
 *   npm run db:cortesia -- email@x.com --dev [--aplicar]  -> o mesmo na branch "dev" do Neon
 *   npm run db:cortesia -- email@x.com --tirar --aplicar  -> tira a cortesia (volta a valer o access_until)
 *
 * Banco: o mesmo de scripts/migrate.ts (.env.local ou .env.dev.local da raiz).
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Pool } from '@neondatabase/serverless'

const root = resolve(import.meta.dirname, '../../..')
const dev = process.argv.includes('--dev')
const apply = process.argv.includes('--aplicar')
const remove = process.argv.includes('--tirar')
const email = process.argv.slice(2).find((a) => a.includes('@'))?.trim().toLowerCase()
if (!email) throw new Error('Passe o e-mail da dona: npm run db:cortesia -- email@x.com')

function envUrl(): string {
  const fromEnv = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
  if (fromEnv) return fromEnv
  const file = join(root, dev ? '.env.dev.local' : '.env.local')
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^(DATABASE_URL_UNPOOLED|DATABASE_URL)=(.*)$/)
      if (m) return m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
  throw new Error(`Defina DATABASE_URL_UNPOOLED ou crie o ${dev ? '.env.dev.local' : '.env.local'} na raiz.`)
}

const url = envUrl()
console.log(`Banco: ${dev ? 'branch DEV' : 'PRODUÇÃO'} (${new URL(url).hostname.split('.')[0]})`)
const pool = new Pool({ connectionString: url })

try {
  const { rows } = await pool.query(
    `select sa.id, sa.name, s.plan, s.status, s.access_until, s.complimentary
     from public.members m
     join neon_auth."user" u on u.id = m.user_id
     join public.salons sa on sa.id = m.salon_id
     join public.subscriptions s on s.salon_id = sa.id
     where lower(u.email) = $1 and m.role = 'owner'`,
    [email],
  )
  if (rows.length === 0) throw new Error('Nenhum negócio em que esse e-mail seja a dona.')
  for (const r of rows) {
    console.log(`- ${r.name}: plano ${r.plan}, ${r.status}, acesso até ${new Date(r.access_until).toISOString().slice(0, 10)}, cortesia ${r.complimentary ? 'sim' : 'não'}`)
  }
  if (!apply && !remove && rows.every((r) => r.complimentary)) {
    console.log('Já é cortesia: nada a fazer.')
  } else if (!apply) {
    console.log(remove ? 'Tiraria a cortesia. Rode de novo com --aplicar.' : 'Viraria cortesia (plano Salão, sem vencimento). Rode de novo com --aplicar.')
  } else {
    const ids = rows.map((r) => r.id as string)
    if (remove) {
      await pool.query(`update public.subscriptions set complimentary = false, updated_at = now() where salon_id = any($1::uuid[])`, [ids])
      console.log('Cortesia removida. O acesso volta a seguir a data de access_until.')
    } else {
      await pool.query(
        `update public.subscriptions
         set complimentary = true, plan = 'salao', status = 'active', trial_ends_at = null,
             access_until = greatest(access_until, '2999-12-31'::timestamptz), cancel_at_period_end = false, updated_at = now()
         where salon_id = any($1::uuid[])`,
        [ids],
      )
      console.log('Pronto: cortesia, plano Salão, sem vencimento.')
    }
  }
} finally {
  await pool.end()
}

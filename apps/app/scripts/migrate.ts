/**
 * Aplica as migrations de neon/migrations/ que ainda não estão em public.schema_migrations, em ordem,
 * cada uma dentro de begin ... commit (rollback se der erro).
 *
 *   npm run db:migrate              -> só lista o que falta (não muda nada)
 *   npm run db:migrate -- --aplicar -> aplica
 *
 * Usa DATABASE_URL_UNPOOLED (ou DATABASE_URL) do .env.local da raiz. Para testar antes, aponte para uma
 * branch do Neon: DATABASE_URL_UNPOOLED=postgres://...branch... npm run db:migrate -- --aplicar
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Pool } from '@neondatabase/serverless'

const root = resolve(import.meta.dirname, '../../..')
const dir = join(root, 'neon/migrations')

/** migrations aplicadas à mão antes da tabela de controle existir (a fase1 registra todas elas) */
const BEFORE_CONTROL = '20261024000000_fase1'

function envUrl(): string {
  const fromEnv = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
  if (fromEnv) return fromEnv
  const file = join(root, '.env.local')
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^(DATABASE_URL_UNPOOLED|DATABASE_URL)=(.*)$/)
      if (m) return m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
  throw new Error('Defina DATABASE_URL_UNPOOLED (ou rode `neon env pull` para criar o .env.local da raiz).')
}

const apply = process.argv.includes('--aplicar')
const pool = new Pool({ connectionString: envUrl() })
const client = await pool.connect()

try {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  const hasControl = (await client.query(`select to_regclass('public.schema_migrations') is not null as ok`)).rows[0].ok as boolean
  const applied = new Set<string>(
    hasControl ? (await client.query('select version from public.schema_migrations')).rows.map((r) => r.version as string) : [],
  )
  const pending = files
    .map((f) => f.replace(/\.sql$/, ''))
    // sem a tabela de controle, tudo antes da fase1 já foi aplicado à mão
    .filter((v) => !applied.has(v) && (hasControl || v >= BEFORE_CONTROL))

  if (pending.length === 0) {
    console.log('Nada a aplicar: o banco está em dia.')
  } else {
    console.log(`${pending.length} migration(s) pendente(s):\n${pending.map((v) => `  - ${v}`).join('\n')}`)
    if (!apply) console.log('\nNada foi alterado. Para aplicar: npm run db:migrate -- --aplicar')
  }

  if (apply) {
    for (const version of pending) {
      const sql = readFileSync(join(dir, `${version}.sql`), 'utf8')
      process.stdout.write(`Aplicando ${version}... `)
      try {
        await client.query('begin')
        await client.query(sql)
        await client.query('insert into public.schema_migrations (version) values ($1) on conflict do nothing', [version])
        await client.query('commit')
        console.log('ok')
      } catch (error) {
        await client.query('rollback')
        console.log('falhou')
        throw error
      }
    }
  }
} finally {
  client.release()
  await pool.end()
}

// Servidor local das rotas /api (agendamento, página pública, conta) ligado à branch "dev" do Neon, para testar o app como um usuário de verdade
// com `npm run dev` (o Vite repassa /api e /s para cá). Aborta se o banco não for a dev. Sem Stripe e sem e-mail (sem chaves, essas partes só falham).
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'

const DEV = 'ep-old-dream-b6e5t7dn'
const PROD = 'ep-twilight-heart-b66hba33'
const root = resolve(import.meta.dirname, '../../..')
const lines = readFileSync(join(root, '.env.dev.local'), 'utf8').split('\n')
const read = (k: string) => lines.find((l) => l.startsWith(k + '='))?.slice(k.length + 1).trim().replace(/^["']|["']$/g, '')
const url = read('DATABASE_URL')!
if (!url.includes(DEV) || url.includes(PROD)) throw new Error('abortado: não é a branch dev')
for (const k of ['DATABASE_URL', 'NEON_AUTH_BASE_URL', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) process.env[k] = read(k) ?? ''
process.env.APP_URL = 'http://localhost:5173'
const [who] = await neon(url)`select current_setting('neon.endpoint_id', true) as ep`
if (who.ep !== DEV) throw new Error('abortado: o servidor não é a branch dev')

type Handler = (r: Request) => Response | Promise<Response>
const load = async (f: string) => (await import(f)) as Record<string, Handler>
const routes: { re: RegExp; mod: string; query: (m: RegExpMatchArray) => string }[] = [
  { re: /^\/api\/auth\/(.*)$/, mod: './../api/auth.ts', query: (m) => `p=${m[1]}` },
  { re: /^\/api\/account\/([a-z-]+)$/, mod: './../api/account.ts', query: (m) => `action=${m[1]}` },
  { re: /^\/api\/billing\/([a-z-]+)$/, mod: './../api/billing.ts', query: (m) => `action=${m[1]}` },
  { re: /^\/api\/booking$/, mod: './../api/booking.ts', query: () => '' },
  { re: /^\/api\/site$/, mod: './../api/site.ts', query: () => '' },
  { re: /^\/s\/([a-z0-9-]+)$/, mod: './../api/site.ts', query: (m) => `slug=${m[1]}` },
  { re: /^\/api\/photo$/, mod: './../api/photo.ts', query: () => '' },
  { re: /^\/api\/photos\/file$/, mod: './../api/photos/file.ts', query: () => '' },
  { re: /^\/api\/photos\/upload$/, mod: './../api/photos/upload.ts', query: () => '' },
]

createServer(async (req, res) => {
  try {
    const u = new URL(req.url ?? '/', 'http://localhost:3001')
    const hit = routes.map((r) => ({ r, m: u.pathname.match(r.re) })).find((x) => x.m)
    if (!hit) {
      res.writeHead(404).end('not found')
      return
    }
    const extra = hit.r.query(hit.m!)
    const target = new URL(u.pathname, 'http://localhost:5173')
    target.search = [extra, u.searchParams.toString()].filter(Boolean).join('&')
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const body = chunks.length ? Buffer.concat(chunks) : undefined
    const request = new Request(target, { method: req.method, headers: req.headers as Record<string, string>, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body })
    const mod = await load(hit.r.mod)
    const handler = mod[req.method ?? 'GET']
    if (!handler) {
      res.writeHead(405).end('method')
      return
    }
    const out = await handler(request)
    const headers: Record<string, string | string[]> = {}
    out.headers.forEach((v, k) => {
      if (k !== 'set-cookie') headers[k] = v
    })
    const cookies = out.headers.getSetCookie()
    if (cookies.length) headers['set-cookie'] = cookies
    res.writeHead(out.status, headers).end(Buffer.from(await out.arrayBuffer()))
  } catch (error) {
    console.error(error)
    res.writeHead(500).end('erro')
  }
}).listen(3001, () => console.log('API local (branch dev) em http://localhost:3001'))

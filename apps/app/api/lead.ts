import { TRIAL_DAYS } from '../src/lib/plans.js'
import { captureLead, parseLeadInput, unsubscribeLead } from './_lib/lead.js'
import { appUrl, createLeadDb, fail, sendEmail } from './_lib/runtime.js'

// a landing fica em ikizy.com e o app em app.ikizy.com: só esses endereços (e o localhost do dev) podem chamar
const ALLOWED = new Set(['https://ikizy.com', 'https://www.ikizy.com', ...(process.env.LANDING_ORIGINS ?? '').split(',').filter(Boolean)])
const allowed = (origin: string | null) => !!origin && (ALLOWED.has(origin) || /^http:\/\/localhost:\d+$/.test(origin))

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get('origin')
  return allowed(origin)
    ? { 'access-control-allow-origin': origin as string, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' }
    : {}
}

const withCors = (response: Response, request: Request) => {
  for (const [k, v] of Object.entries(cors(request))) response.headers.set(k, v)
  return response
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

/** página simples (preto e branco, como o resto da marca) para o link de sair da lista */
function page(title: string, text: string, form?: { email: string; token: string }, status = 200) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const button = form
    ? `<form method="post" action="/api/lead?e=${encodeURIComponent(form.email)}&t=${encodeURIComponent(form.token)}"><button type="submit">Sair da lista</button></form>`
    : ''
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0d0d;color:#fff;font:400 17px/1.5 Outfit,Arial,sans-serif;padding:24px}main{max-width:420px}h1{font-weight:300;font-size:40px;line-height:1.05;letter-spacing:-1.5px;margin:0 0 12px}p{color:#a3a3a8;margin:0 0 24px}button{font:500 16px Outfit,Arial,sans-serif;background:#fff;color:#0e0d0d;border:0;border-radius:999px;padding:14px 28px;cursor:pointer}</style></head><body><main><h1>${esc(title)}</h1><p>${esc(text)}</p>${button}</main></body></html>`
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
}

/** GET ?e=&t= -> página de confirmação. Só o POST tira da lista, para leitores de e-mail que abrem links não saírem sozinhos. */
export function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const email = q.get('e') ?? ''
  const token = q.get('t') ?? ''
  if (!email || !token) return page('Link inválido', 'Use o link do e-mail mais recente.', undefined, 400)
  return page('Sair da lista?', `Você não vai mais receber e-mails da IKIZY em ${email}.`, { email, token })
}

/** POST { email, website? } -> 204. Grava o e-mail da landing e manda a apresentação do IKIZY (uma vez por e-mail). */
export async function POST(request: Request) {
  try {
    const q = new URL(request.url).searchParams
    if (q.has('t')) {
      // pedido de sair da lista (botão da página ou "um clique" do Gmail)
      await unsubscribeLead(createLeadDb(), q.get('e') ?? '', q.get('t') ?? '', process.env.CRON_SECRET ?? '')
      return page('Pronto', 'Você saiu da lista e não vai mais receber e-mails da IKIZY.')
    }
    const ip = (request.headers.get('x-forwarded-for') ?? 'desconhecido').split(',')[0].trim()
    const input = parseLeadInput(await request.json().catch(() => null))
    await captureLead({ db: createLeadDb(), send: sendEmail, appUrl: appUrl(), trialDays: TRIAL_DAYS, notifyTo: process.env.LEAD_NOTIFY_EMAIL || 'maria.eduarda@simpledealers.com.br', secret: process.env.CRON_SECRET || undefined }, input, ip)
    return withCors(new Response(null, { status: 204 }), request)
  } catch (error) {
    return withCors(fail(error), request)
  }
}

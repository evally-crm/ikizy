import { TRIAL_DAYS } from '../src/lib/plans.js'
import { captureLead, parseLeadInput } from './_lib/lead.js'
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

/** POST { email, website? } -> 204. Grava o e-mail da landing e manda a apresentação do IKIZY (uma vez por e-mail). */
export async function POST(request: Request) {
  try {
    const ip = (request.headers.get('x-forwarded-for') ?? 'desconhecido').split(',')[0].trim()
    const input = parseLeadInput(await request.json().catch(() => null))
    await captureLead({ db: createLeadDb(), send: sendEmail, appUrl: appUrl(), trialDays: TRIAL_DAYS }, input, ip)
    return withCors(new Response(null, { status: 204 }), request)
  } catch (error) {
    return withCors(fail(error), request)
  }
}

import { HttpError } from './billing.js'

/** horário livre devolvido por public.get_available_slots(); minute = minutos desde 00:00 do dia */
export interface Slot {
  professional_id: string
  professional: string
  minute: number
}

export interface BookingResult {
  id: string
  starts_at: string
  service: string
  professional: string
  price: number
  duration: number
}

export interface BookingDb {
  slots(q: SlotsQuery): Promise<Slot[]>
  book(input: BookingInput): Promise<BookingResult>
  /** registra uma tentativa no limitador do banco (vale entre instâncias); true = passou do limite */
  limited(bucket: string, max: number, windowSeconds: number): Promise<boolean>
}

export interface SlotsQuery {
  slug: string
  service: string
  date: string
  professional: string | null
}

export interface BookingInput extends SlotsQuery {
  minute: number
  name: string
  phone: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

const bad = (message: string) => new HttpError(400, 'invalid_input', message)

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function parseCommon(slug: unknown, service: unknown, date: unknown, professional: unknown): SlotsQuery {
  const s = typeof slug === 'string' ? slug.toLowerCase() : ''
  if (!SLUG.test(s) || s.length < 3 || s.length > 40) throw bad('Endereço do salão inválido.')
  if (typeof service !== 'string' || !UUID.test(service)) throw bad('Escolha um serviço.')
  if (typeof date !== 'string' || !isRealDate(date)) throw bad('Escolha um dia válido.')
  const pro = professional == null || professional === '' ? null : professional
  if (pro !== null && (typeof pro !== 'string' || !UUID.test(pro))) throw bad('Profissional inválida.')
  return { slug: s, service, date, professional: pro as string | null }
}

export function parseSlotsQuery(url: URL): SlotsQuery {
  const p = url.searchParams
  return parseCommon(p.get('slug'), p.get('service'), p.get('date'), p.get('professional'))
}

/** corpo do POST; `honeypot` = campo escondido que só robôs preenchem */
export function parseBookingInput(body: unknown): BookingInput & { honeypot: boolean; captcha: string } {
  if (!body || typeof body !== 'object') throw bad('Pedido inválido.')
  const b = body as Record<string, unknown>
  const common = parseCommon(b.slug, b.service, b.date, b.professional)
  const minute = typeof b.minute === 'number' && Number.isInteger(b.minute) ? b.minute : NaN
  if (!(minute >= 0 && minute <= 1439)) throw bad('Escolha um horário.')
  const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 2 || name.length > 80) throw bad('Informe seu nome.')
  const phone = typeof b.phone === 'string' ? b.phone : ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) throw bad('Informe um WhatsApp com DDD.')
  // LGPD: a cliente precisa autorizar o uso do nome e do WhatsApp antes de o pedido ser gravado
  if (b.consent !== true) throw bad('Para pedir o horário, autorize o uso dos seus dados.')
  const captcha = typeof b.captcha === 'string' ? b.captcha.slice(0, 2048) : ''
  return { ...common, minute, name, phone: digits, honeypot: typeof b.company === 'string' && b.company.trim() !== '', captcha }
}

/**
 * confere o desafio do Cloudflare Turnstile. Sem `secret` configurado não confere nada (o site funciona
 * como antes); com ele, pedido sem token válido é recusado.
 */
export async function verifyCaptcha(
  token: string,
  ip: string,
  secret: string | undefined,
  post: (body: URLSearchParams) => Promise<{ success?: boolean }> = (body) =>
    fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body }).then((r) => r.json() as Promise<{ success?: boolean }>),
): Promise<void> {
  if (!secret) return
  const refuse = () => new HttpError(403, 'captcha', 'Não conseguimos confirmar que você não é um robô. Tente de novo.')
  if (!token) throw refuse()
  const body = new URLSearchParams({ secret, response: token })
  if (ip && ip !== 'desconhecido') body.set('remoteip', ip)
  let ok = false
  try {
    ok = (await post(body)).success === true
  } catch {
    // Cloudflare fora do ar: melhor deixar a cliente agendar (os limites por IP e telefone continuam valendo)
    return
  }
  if (!ok) throw refuse()
}

/** erros com mensagem fixa levantados pelas funções do banco */
export function translateDbError(error: unknown): HttpError {
  const text = error instanceof Error ? error.message : String(error)
  if (text.includes('slot_unavailable')) return new HttpError(409, 'slot_unavailable', 'Esse horário acabou de ser ocupado. Escolha outro.')
  if (text.includes('booking_disabled')) return new HttpError(403, 'booking_disabled', 'Este salão ainda não aceita agendamentos online.')
  if (text.includes('too_many')) return new HttpError(429, 'too_many', 'Você já tem pedidos em aberto. Aguarde a confirmação do salão.')
  if (text.includes('invalid_input')) return bad('Confira os dados e tente de novo.')
  throw error
}

export async function listSlots(db: BookingDb, q: SlotsQuery): Promise<Slot[]> {
  try {
    return await db.slots(q)
  } catch (error) {
    throw translateDbError(error)
  }
}

export async function createBooking(db: BookingDb, input: BookingInput): Promise<BookingResult> {
  try {
    return await db.book(input)
  } catch (error) {
    throw translateDbError(error)
  }
}

/** limite simples por IP (por instância do servidor): 12 pedidos em 10 minutos */
const hits = new Map<string, number[]>()
export function tooManyFromIp(ip: string, now = Date.now(), max = 12, windowMs = 10 * 60_000): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k)
  return recent.length > max
}

/** limites por tentativa de pedido: por IP (anônimo, só o resumo) e por WhatsApp */
export const BOOKING_LIMITS = { perIp: { max: 10, windowSeconds: 3600 }, perPhone: { max: 5, windowSeconds: 3600 } } as const

/** resumo curto e irreversível do dado, para não guardar IP nem telefone puros no limitador */
export async function shortHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * confere os limites do pedido no banco (R-65). Se o limitador falhar (ex.: migration ainda não aplicada),
 * segue sem ele: a trava por salão e por cliente dentro de book_appointment() continua valendo.
 */
export async function checkBookingLimits(db: BookingDb, ip: string, phone: string): Promise<void> {
  try {
    const [ipKey, phoneKey] = await Promise.all([shortHash(ip), shortHash(phone)])
    const [byIp, byPhone] = await Promise.all([
      db.limited(`booking:ip:${ipKey}`, BOOKING_LIMITS.perIp.max, BOOKING_LIMITS.perIp.windowSeconds),
      db.limited(`booking:phone:${phoneKey}`, BOOKING_LIMITS.perPhone.max, BOOKING_LIMITS.perPhone.windowSeconds),
    ])
    if (byIp || byPhone) throw new HttpError(429, 'too_many', 'Muitas tentativas. Aguarde alguns minutos.')
  } catch (error) {
    if (error instanceof HttpError) throw error
    console.error('limitador de pedidos indisponível', error)
  }
}

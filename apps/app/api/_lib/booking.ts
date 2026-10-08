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
export function parseBookingInput(body: unknown): BookingInput & { honeypot: boolean } {
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
  return { ...common, minute, name, phone: digits, honeypot: typeof b.company === 'string' && b.company.trim() !== '' }
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

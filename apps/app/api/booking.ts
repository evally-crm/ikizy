import { HttpError } from './_lib/billing.js'
import { checkBookingLimits, createBooking, listSlots, parseBookingInput, parseSlotsQuery, tooManyFromIp, verifyCaptcha } from './_lib/booking.js'
import { createBookingDb, fail, json } from './_lib/runtime.js'

/** GET /api/booking?slug=&service=&date=YYYY-MM-DD[&professional=] -> { slots: [{ professional_id, professional, minute }] } */
export async function GET(request: Request) {
  try {
    const query = parseSlotsQuery(new URL(request.url))
    const slots = await listSlots(createBookingDb(), query)
    return json({ slots })
  } catch (error) {
    return fail(error)
  }
}

/** POST { slug, service, professional?, date, minute, name, phone } -> { booking } (pedido fica "pendente" até o salão confirmar) */
export async function POST(request: Request) {
  try {
    const ip = (request.headers.get('x-forwarded-for') ?? 'desconhecido').split(',')[0].trim()
    if (tooManyFromIp(ip)) throw new HttpError(429, 'too_many', 'Muitas tentativas. Aguarde alguns minutos.')
    const { honeypot, captcha, ...input } = parseBookingInput(await request.json().catch(() => null))
    // robô: responde como se tivesse dado certo, sem gravar nada
    if (honeypot) return json({ booking: { id: 'ok', starts_at: new Date().toISOString(), service: '', professional: '', price: 0, duration: 0 } })
    await verifyCaptcha(captcha, ip, process.env.TURNSTILE_SECRET_KEY)
    const db = createBookingDb()
    await checkBookingLimits(db, ip, input.phone)
    const booking = await createBooking(db, input)
    return json({ booking }, 201)
  } catch (error) {
    return fail(error)
  }
}

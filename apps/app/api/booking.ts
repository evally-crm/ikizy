import { HttpError } from './_lib/billing.js'
import { checkBookingLimits, createBooking, isReviewRequest, listSlots, parseBookingInput, parseReviewInput, parseSlotsQuery, tooManyFromIp, translateDbError, verifyCaptcha } from './_lib/booking.js'
import { notifyNewRequest } from './_lib/notify.js'
import { pushNewRequest } from './_lib/push.js'
import { appUrl, createBookingDb, createNotifyDb, createPushDb, createPushSender, fail, json, saveReview, sendEmail } from './_lib/runtime.js'

/** GET /api/booking?slug=&service=<id>[,<id>...]&date=YYYY-MM-DD[&professional=] -> { slots: [{ professional_id, professional, minute }] } */
export async function GET(request: Request) {
  try {
    const query = parseSlotsQuery(new URL(request.url))
    const slots = await listSlots(createBookingDb(), query)
    return json({ slots })
  } catch (error) {
    return fail(error)
  }
}

/** POST { slug, services: [ids] (ou service: id), professional?, date, minute, name, phone, consent: true } -> { booking } (pedido fica "pendente" até o salão confirmar) */
export async function POST(request: Request) {
  try {
    const ip = (request.headers.get('x-forwarded-for') ?? 'desconhecido').split(',')[0].trim()
    if (tooManyFromIp(ip)) throw new HttpError(429, 'too_many', 'Muitas tentativas. Aguarde alguns minutos.')
    const body = await request.json().catch(() => null)
    // avaliação da cliente, pela página do pedido (o link secreto é a prova de que foi ela)
    if (isReviewRequest(body)) {
      const review = parseReviewInput(body)
      await saveReview(review.token, review.rating, review.comment).catch((error) => {
        throw translateDbError(error)
      })
      return json({ review: { rating: review.rating, comment: review.comment } }, 201)
    }
    const { honeypot, captcha, ...input } = parseBookingInput(body)
    // robô: responde como se tivesse dado certo, sem gravar nada
    if (honeypot) return json({ booking: { id: 'ok', starts_at: new Date().toISOString(), service: '', professional: '', price: 0, duration: 0 } })
    await verifyCaptcha(captcha, ip, process.env.TURNSTILE_SECRET_KEY)
    const db = createBookingDb()
    await checkBookingLimits(db, ip, input.phone)
    const booking = await createBooking(db, input)
    // e-mail para a dona (E5); se falhar, o pedido continua gravado e aparece no sininho do app
    await notifyNewRequest({ db: createNotifyDb(), send: sendEmail, appUrl: appUrl() }, input.slug, {
      id: booking.id,
      startsAt: booking.starts_at,
      service: booking.service,
      professional: booking.professional || null,
      clientName: input.name,
      clientPhone: input.phone,
    })
    // aviso no aparelho de quem trata pedidos (se os avisos estiverem configurados); nunca atrapalha a resposta
    const sender = createPushSender()
    if (sender) await pushNewRequest({ db: createPushDb(), send: sender }, input.slug, { id: booking.id, startsAt: booking.starts_at, service: booking.service, clientName: input.name })
    return json({ booking }, 201)
  } catch (error) {
    return fail(error)
  }
}

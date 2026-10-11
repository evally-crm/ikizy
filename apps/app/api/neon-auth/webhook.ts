import { FROM, parseOtpEvent, renderOtpEmail, verifyNeonWebhook } from '../_lib/authEmail.js'
import { env, json } from '../_lib/runtime.js'

/**
 * webhook do Neon Auth (`send.otp`): o Neon não manda o e-mail padrão, quem manda é este endpoint, com a cara do IKIZY.
 * A assinatura do corpo bruto é conferida antes de qualquer coisa. Responder 5xx faz o Neon tentar de novo (até 3 vezes).
 */
export async function POST(request: Request) {
  const raw = await request.text()

  let payload: unknown
  try {
    const base = env('NEON_AUTH_BASE_URL').replace(/\/$/, '')
    const res = await fetch(`${base}/.well-known/jwks.json`)
    if (!res.ok) throw new Error(`jwks ${res.status}`)
    payload = verifyNeonWebhook(raw, request.headers, (await res.json()) as { keys: [] })
  } catch (error) {
    console.error('neon-auth webhook: assinatura', error)
    return json({ error: 'invalid_signature' }, 401)
  }

  const event = parseOtpEvent(payload)
  // outros eventos (ou código por SMS): nada a fazer aqui
  if (!event) return json({ received: true })

  try {
    const { subject, html, text } = renderOtpEmail(event.code, event.email, event.otpType)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [event.email], subject, html, text }),
    })
    if (!res.ok) throw new Error(`resend ${res.status} ${await res.text()}`)
    return json({ received: true })
  } catch (error) {
    console.error('neon-auth webhook: envio', error)
    return json({ error: 'send_failed' }, 500)
  }
}

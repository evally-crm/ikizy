import { handleStripeEvent } from '../_lib/billing.js'
import { createDb, env, json, stripe } from '../_lib/runtime.js'

/** webhook do Stripe: a assinatura do corpo bruto é conferida antes de qualquer coisa */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return json({ error: 'missing_signature' }, 400)

  const raw = await request.text()
  let event
  try {
    event = await stripe().webhooks.constructEventAsync(raw, signature, env('STRIPE_WEBHOOK_SECRET'))
  } catch {
    return json({ error: 'invalid_signature' }, 400)
  }

  try {
    await handleStripeEvent(event, createDb())
    return json({ received: true })
  } catch (error) {
    // 500 faz o Stripe tentar de novo mais tarde
    console.error('webhook', event.type, error)
    return json({ error: 'handler_failed' }, 500)
  }
}

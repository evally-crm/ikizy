import { createCheckout, parseCheckoutInput } from '../_lib/billing.js'
import { appUrl, authenticate, createDb, fail, json, stripe } from '../_lib/runtime.js'

/** POST { plan, method: 'card' | 'pix', months? } -> { url } do Checkout do Stripe */
export async function POST(request: Request) {
  try {
    const user = await authenticate(request)
    const input = parseCheckoutInput(await request.json().catch(() => null))
    const result = await createCheckout({ db: createDb(), stripe: stripe(), appUrl: appUrl() }, user, input)
    return json(result)
  } catch (error) {
    return fail(error)
  }
}

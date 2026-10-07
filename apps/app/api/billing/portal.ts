import { createPortal } from '../_lib/billing.js'
import { appUrl, authenticate, createDb, fail, json, stripe } from '../_lib/runtime.js'

/** POST -> { url } do portal do Stripe (trocar cartão, ver faturas, cancelar) */
export async function POST(request: Request) {
  try {
    const user = await authenticate(request)
    const result = await createPortal({ db: createDb(), stripe: stripe(), appUrl: appUrl(), portalConfiguration: process.env.STRIPE_PORTAL_CONFIGURATION }, user)
    return json(result)
  } catch (error) {
    return fail(error)
  }
}

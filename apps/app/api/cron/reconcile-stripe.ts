import { reconcileStripe } from '../_lib/billing.js'
import { assertCronAuthorized } from '../_lib/cron.js'
import { createReconcileDb, fail, json, stripe } from '../_lib/runtime.js'

/** GET (cron diário da Vercel, 3h de Brasília): confere assinaturas e Pix com o Stripe, caso algum webhook tenha se perdido */
export async function GET(request: Request) {
  try {
    assertCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)
    return json(await reconcileStripe({ db: createReconcileDb(), stripe: stripe() }))
  } catch (error) {
    return fail(error)
  }
}

import { createCheckout, createExtraCampaignCheckout, parseCheckoutInput, parseExtraCampaignInput } from '../_lib/billing.js'
import { appUrl, authenticate, createDb, fail, json, stripe } from '../_lib/runtime.js'

/**
 * POST { plan, method: 'card' | 'pix', months? } -> { url } do Checkout do Stripe
 * POST { kind: 'campaign_credit', quantity } -> { url } para comprar campanhas extras de oferta
 */
export async function POST(request: Request) {
  try {
    const user = await authenticate(request)
    const body = await request.json().catch(() => null)
    const deps = { db: createDb(), stripe: stripe(), appUrl: appUrl() }
    if ((body as { kind?: unknown } | null)?.kind === 'campaign_credit') {
      return json(await createExtraCampaignCheckout(deps, user, parseExtraCampaignInput(body)))
    }
    const result = await createCheckout(deps, user, parseCheckoutInput(body))
    return json(result)
  } catch (error) {
    return fail(error)
  }
}

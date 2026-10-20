import { HttpError, changePlan } from '../_lib/billing.js'
import { isPlanId } from '../../src/lib/plans.js'
import { appUrl, authenticate, createDb, fail, json, stripe } from '../_lib/runtime.js'

/** POST { plan } -> troca o plano da assinatura no cartão (subir cobra a diferença na hora; descer vale na próxima cobrança) */
export async function POST(request: Request) {
  try {
    const user = await authenticate(request)
    const body = (await request.json().catch(() => null)) as { plan?: unknown } | null
    if (!isPlanId(body?.plan)) throw new HttpError(400, 'invalid_plan', 'Plano inválido.')
    return json(await changePlan({ db: createDb(), stripe: stripe(), appUrl: appUrl() }, user, body.plan))
  } catch (error) {
    return fail(error)
  }
}

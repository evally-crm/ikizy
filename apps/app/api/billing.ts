import { HttpError, changePlan, createCheckout, createPortal, parseCheckoutInput } from './_lib/billing.js'
import { isPlanId } from '../src/lib/plans.js'
import { appUrl, authenticate, createDb, fail, json, stripe } from './_lib/runtime.js'

type User = Awaited<ReturnType<typeof authenticate>>
type Deps = { db: ReturnType<typeof createDb>; stripe: ReturnType<typeof stripe>; appUrl: string }

// uma função só para a cobrança (o plano Hobby da Vercel aceita 12 funções por deploy);
// /api/billing/<ação> chega aqui como /api/billing?action=<ação> (vercel.json)
const ACTIONS: Record<string, (deps: Deps, user: User, body: unknown) => Promise<unknown>> = {
  /** { plan, method: 'card' | 'pix', months? } -> { url } do Checkout do Stripe */
  checkout: (deps, user, body) => createCheckout(deps, user, parseCheckoutInput(body)),
  /** { plan } -> troca o plano da assinatura no cartão (subir cobra a diferença na hora; descer vale na próxima cobrança) */
  'change-plan': (deps, user, body) => {
    const plan = (body as { plan?: unknown } | null)?.plan
    if (!isPlanId(plan)) throw new HttpError(400, 'invalid_plan', 'Plano inválido.')
    return changePlan(deps, user, plan)
  },
  /** -> { url } do portal do Stripe (trocar cartão, ver faturas, cancelar) */
  portal: (deps, user) => createPortal({ ...deps, portalConfiguration: process.env.STRIPE_PORTAL_CONFIGURATION }, user),
}

/** POST /api/billing/<ação> */
export async function POST(request: Request) {
  try {
    const action = ACTIONS[new URL(request.url).searchParams.get('action') ?? '']
    if (!action) throw new HttpError(404, 'not_found', 'Ação não encontrada.')
    const user = await authenticate(request)
    const body = await request.json().catch(() => null)
    return json(await action({ db: createDb(), stripe: stripe(), appUrl: appUrl() }, user, body))
  } catch (error) {
    return fail(error)
  }
}

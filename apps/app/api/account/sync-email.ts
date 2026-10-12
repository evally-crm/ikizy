import { HttpError } from '../_lib/billing.js'
import { authenticate, fail, json, setNotifyEmail } from '../_lib/runtime.js'

/**
 * POST (sem corpo): guarda o e-mail confirmado do login da dona para os avisos de cobrança.
 * O e-mail vem do token verificado, nunca do corpo da chamada.
 */
export async function POST(request: Request) {
  try {
    const user = await authenticate(request)
    if (!user.email) throw new HttpError(400, 'no_email', 'Sua conta não tem e-mail.')
    await setNotifyEmail(user.id, user.email)
    return json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}

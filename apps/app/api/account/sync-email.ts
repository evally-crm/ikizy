import { HttpError } from '../_lib/billing.js'
import { sendWelcome } from '../_lib/notify.js'
import { appUrl, authenticate, createNotifyDb, fail, json, sendEmail, setNotifyEmail } from '../_lib/runtime.js'

/**
 * POST (sem corpo): guarda o e-mail confirmado do login da dona para os avisos de cobrança.
 * O e-mail vem do token verificado, nunca do corpo da chamada.
 * Negócio criado há pouco ganha o e-mail de boas-vindas (E3), uma vez só.
 */
export async function POST(request: Request) {
  try {
    const user = await authenticate(request)
    if (!user.email) throw new HttpError(400, 'no_email', 'Sua conta não tem e-mail.')
    await setNotifyEmail(user.id, user.email)
    const db = createNotifyDb()
    const deps = { db, send: sendEmail, appUrl: appUrl() }
    for (const salon of await db.recentOwnedSalons(user.id).catch(() => [])) await sendWelcome(deps, salon)
    return json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}

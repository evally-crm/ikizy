import { adminDeleteSalon, adminListSalons, deleteAccount, isAdmin, parseAdminEmails, type AccountDeps } from './_lib/account.js'
import { HttpError } from './_lib/billing.js'
import { sendWelcome } from './_lib/notify.js'
import {
  appUrl,
  authenticate,
  createAccountDb,
  createNotifyDb,
  deleteBlobPrefix,
  fail,
  json,
  sendEmail,
  setNotifyEmail,
  stripe,
} from './_lib/runtime.js'

type User = Awaited<ReturnType<typeof authenticate>>

// uma função só para a conta (o plano Hobby da Vercel aceita 12 funções por deploy);
// /api/account/<ação> chega aqui como /api/account?action=<ação> (vercel.json)

const deps = (): AccountDeps => ({
  db: createAccountDb(),
  deleteCustomer: async (id) => {
    await stripe().customers.del(id)
  },
  deletePhotos: deleteBlobPrefix,
})

const admins = () => parseAdminEmails(process.env.ADMIN_EMAILS)

const ACTIONS: Record<string, (user: User, body: unknown) => Promise<unknown>> = {
  /**
   * guarda o e-mail confirmado do login da dona para os avisos de cobrança (vem do token, nunca do corpo).
   * Negócio criado há pouco ganha o e-mail de boas-vindas (E3), uma vez só.
   */
  'sync-email': async (user) => {
    if (!user.email) throw new HttpError(400, 'no_email', 'Sua conta não tem e-mail.')
    await setNotifyEmail(user.id, user.email)
    const db = createNotifyDb()
    const notify = { db, send: sendEmail, appUrl: appUrl() }
    for (const salon of await db.recentOwnedSalons(user.id).catch(() => [])) await sendWelcome(notify, salon)
    return { ok: true }
  },
  /** { confirm: true } -> apaga a conta (dona: o negócio inteiro e a assinatura) */
  delete: (user, body) => deleteAccount(deps(), user, body),
  /** -> { admin } se quem está logada é master */
  me: async (user) => ({ admin: await isAdmin(createAccountDb(), admins(), user) }),
  /** master: todos os negócios */
  'admin-salons': (user) => adminListSalons(deps(), admins(), user),
  /** master: { salonId } -> apaga o negócio e o login da dona */
  'admin-delete': (user, body) => adminDeleteSalon(deps(), admins(), user, body),
}

/** POST /api/account/<ação> */
export async function POST(request: Request) {
  try {
    const action = ACTIONS[new URL(request.url).searchParams.get('action') ?? '']
    if (!action) throw new HttpError(404, 'not_found', 'Ação não encontrada.')
    const user = await authenticate(request)
    const body = await request.json().catch(() => null)
    return json(await action(user, body))
  } catch (error) {
    return fail(error)
  }
}

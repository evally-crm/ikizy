import {
  adminAuditLog,
  adminDeleteSalon,
  adminListSalons,
  cancelDeletion,
  deleteAccount,
  deletionStatus,
  isAdmin,
  parseAdminEmails,
} from './_lib/account.js'
import { HttpError } from './_lib/billing.js'
import { sendWelcome } from './_lib/notify.js'
import type { LimitKey } from './_lib/throttle.js'
import {
  appUrl,
  authenticate,
  createAccountDb,
  createAccountDeps,
  createNotifyDb,
  fail,
  json,
  limitUser,
  sendEmail,
  setNotifyEmail,
} from './_lib/runtime.js'

type User = Awaited<ReturnType<typeof authenticate>>

// uma função só para a conta (o plano Hobby da Vercel aceita 12 funções por deploy);
// /api/account/<ação> chega aqui como /api/account?action=<ação> (vercel.json)

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
  /**
   * { confirmation } -> pede a exclusão se o texto bater (dona: o nome do negócio; equipe: "excluir").
   * Dona: agenda para daqui a 7 dias ({ scheduled }); equipe: apaga na hora ({ deleted }).
   */
  delete: (user, body) => deleteAccount(createAccountDeps(), user, body),
  /** a dona desiste da exclusão agendada */
  'cancel-delete': (user) => cancelDeletion(createAccountDeps(), user),
  /** -> { admin, deletionAt }: se quem está logada é master e quando a exclusão dela acontece (null = nada agendado) */
  me: async (user) => {
    const db = createAccountDb()
    const [admin, deletionAt] = await Promise.all([isAdmin(db, admins(), user), deletionStatus(db, user.id)])
    return { admin, deletionAt }
  },
  /** master: todos os negócios */
  'admin-salons': (user) => adminListSalons(createAccountDeps(), admins(), user),
  /** master: o registro das últimas ações */
  'admin-log': (user) => adminAuditLog(createAccountDeps(), admins(), user),
  /** master: { salonId, confirmation: endereço do negócio } -> apaga o negócio e o login da dona na hora, com registro */
  'admin-delete': (user, body) => adminDeleteSalon(createAccountDeps(), admins(), user, body),
}

/** POST /api/account/<ação> */
export async function POST(request: Request) {
  try {
    const name = new URL(request.url).searchParams.get('action') ?? ''
    const action = ACTIONS[name]
    if (!action) throw new HttpError(404, 'not_found', 'Ação não encontrada.')
    const user = await authenticate(request)
    await limitUser(user.id, `account:${name}` as LimitKey)
    const body = await request.json().catch(() => null)
    return json(await action(user, body))
  } catch (error) {
    return fail(error)
  }
}

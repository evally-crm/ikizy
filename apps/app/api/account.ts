import {
  adminAuditLog,
  adminDeleteSalon,
  accountSummary,
  adminListSalons,
  cancelDeletion,
  deleteAccount,
  deletionStatus,
  isAdmin,
  parseAdminEmails,
} from './_lib/account.js'
import { HttpError } from './_lib/billing.js'
import { exportData } from './_lib/export.js'
import { subscribe as pushSubscribe, unsubscribe as pushUnsubscribe } from './_lib/push.js'
import { sendWelcome } from './_lib/notify.js'
import type { LimitKey } from './_lib/throttle.js'
import {
  appUrl,
  authenticate,
  createAccountDb,
  createAccountDeps,
  createExportLoader,
  createPushDb,
  createNotifyDb,
  fail,
  json,
  limitUser,
  sendEmail,
  setNotifyEmail,
  vapidPublicKey,
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
   * { confirmation, reason?, comment? } -> pede a exclusão se o texto bater (dona: o nome do negócio; equipe: "excluir").
   * Dona: agenda para daqui a 7 dias ({ scheduled }); equipe: apaga na hora ({ deleted }).
   */
  delete: (user, body) => deleteAccount(createAccountDeps(), user, body),
  /** a dona baixa uma cópia dos dados do negócio (ZIP com planilhas e dados.json) */
  export: async (user) => {
    const pkg = await exportData({ db: createAccountDb(), load: createExportLoader() }, user)
    return new Response(pkg.bytes, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${pkg.filename}"`,
        'cache-control': 'no-store',
      },
    })
  },
  /** o que a tela "Excluir conta" mostra antes de confirmar: quanto o negócio tem e quando a exclusão acontece */
  summary: (user) => accountSummary(createAccountDb(), user.id),
  /** -> { publicKey }: a chave dos avisos no aparelho (null = avisos não configurados neste ambiente) */
  'push-config': async () => ({ publicKey: vapidPublicKey() }),
  /** { subscription, userAgent? } -> liga o aviso de pedido novo neste aparelho (dona, gerente e recepção) */
  'push-subscribe': async (user, body) => {
    if (!vapidPublicKey()) throw new HttpError(503, 'push_not_configured', 'Os avisos ainda não estão ligados neste ambiente.')
    const member = await createAccountDb().getMembership(user.id)
    if (!member) throw new HttpError(403, 'forbidden', 'Seu perfil não recebe avisos de pedido.')
    const ua = (body as { userAgent?: unknown } | null)?.userAgent
    return pushSubscribe(createPushDb(), user, member.salonId, body, typeof ua === 'string' ? ua : null)
  },
  /** { endpoint } -> desliga o aviso neste aparelho */
  'push-unsubscribe': (user, body) => pushUnsubscribe(createPushDb(), user, body),
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
    const result = await action(user, body)
    // a cópia dos dados é um arquivo, não JSON
    return result instanceof Response ? result : json(result)
  } catch (error) {
    return fail(error)
  }
}

import { renderClosedEmail, type ClosedKind } from './accountEmail.js'
import { HttpError, type Membership } from './billing.js'
import { reportError } from './monitoring.js'
import type { SendEmail } from './reminders.js'

/**
 * excluir a conta (LGPD) e o acesso master da IKIZY.
 *
 * Dona: cancela a cobrança no Stripe (apagando o cliente de lá), apaga o negócio inteiro (clientes, agenda, caixa,
 * site, equipe, convites) e as fotos da loja, e por fim o login. Quem é da equipe: sai do negócio e o login é apagado.
 * Master: e-mails em ADMIN_EMAILS (só no servidor) veem todos os negócios e podem apagar um deles do mesmo jeito.
 * Quem pede precisa mandar o texto de confirmação, e o servidor confere (não basta ter um token válido).
 * Depois de apagar, a pessoa e a equipe que perdeu o acesso recebem um e-mail.
 */

export interface AccountDb {
  getMembership(userId: string): Promise<Membership | null>
  /** cliente do Stripe do negócio (null se nunca pagou no cartão nem no Pix) */
  stripeCustomer(salonId: string): Promise<string | null>
  /** apaga o negócio e tudo que pende dele, numa transação só */
  deleteSalon(salonId: string): Promise<void>
  /** tira a pessoa da equipe (o atendimento dela continua, sem login ligado) */
  leaveSalon(salonId: string, userId: string): Promise<void>
  /** apaga o login (sessões e contas ligadas caem junto) */
  deleteUser(userId: string): Promise<void>
  /** dona do negócio (para o master apagar o login dela junto) */
  ownerOf(salonId: string): Promise<string | null>
  /** o e-mail do login foi confirmado? (o master só vale com e-mail confirmado) */
  emailVerified(userId: string): Promise<boolean>
  listSalons(): Promise<AdminSalon[]>
  /** nome e endereço do negócio (o endereço é o que o master digita para confirmar) */
  salonInfo(salonId: string): Promise<{ name: string; slug: string } | null>
  /** e-mails de quem tem login no negócio; precisa ser lido ANTES de apagar */
  contactsOf(salonId: string): Promise<{ ownerEmail: string | null; memberEmails: string[] }>
}

export interface AdminSalon {
  id: string
  name: string
  slug: string
  createdAt: string
  ownerEmail: string | null
  ownerName: string | null
  plan: string | null
  status: string | null
  accessUntil: string | null
  method: string | null
  clients: number
  appointments: number
  members: number
}

export interface AccountDeps {
  db: AccountDb
  /** apaga o cliente no Stripe (cancela na hora qualquer assinatura dele) */
  deleteCustomer: (customerId: string) => Promise<void>
  /** apaga da loja tudo que começa com o prefixo */
  deletePhotos: (prefix: string) => Promise<void>
  /** e-mail de aviso depois da exclusão (um erro aqui nunca desfaz nem trava a exclusão) */
  send: SendEmail
}

export interface User {
  id: string
  email?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** o que quem não é dona digita para confirmar (a dona digita o nome do negócio; o master, o endereço dele) */
export const CONFIRM_WORD = 'excluir'

const same = (typed: unknown, expected: string) => typeof typed === 'string' && typed.trim().toLowerCase() === expected.trim().toLowerCase()

const mismatch = () => new HttpError(400, 'confirm_mismatch', 'O texto digitado não confere. Confira e tente de novo.')

/** manda o aviso sem nunca derrubar a exclusão (que já aconteceu); o destino vem do banco ou do token, não do corpo da chamada */
async function notify(deps: AccountDeps, to: string | null | undefined, kind: ClosedKind, salonName: string, hadCard: boolean) {
  if (!to) return
  try {
    await deps.send({ to, ...renderClosedEmail(kind, salonName, hadCard) })
  } catch (error) {
    reportError(error, 'aviso de conta excluída')
  }
}

/** apaga um negócio de ponta a ponta; a cobrança vem primeiro, para nunca sobrar assinatura cobrando um negócio que não existe */
export async function wipeSalon(deps: AccountDeps, salonId: string): Promise<{ hadCard: boolean }> {
  const customer = await deps.db.stripeCustomer(salonId)
  if (customer) {
    try {
      await deps.deleteCustomer(customer)
    } catch (error) {
      // cliente já apagado no Stripe: segue; qualquer outra falha para tudo (melhor não apagar do que deixar cobrando)
      if ((error as { code?: string }).code !== 'resource_missing') throw error
    }
  }
  await deps.db.deleteSalon(salonId)
  // as fotos que sobrarem a limpeza diária apaga (o banco não aponta mais para elas)
  await deps.deletePhotos(`salons/${salonId}/`).catch(() => undefined)
  return { hadCard: Boolean(customer) }
}

/** a pessoa logada apaga a própria conta; o servidor confere o texto digitado: nome do negócio (dona) ou "excluir" (os demais) */
export async function deleteAccount(deps: AccountDeps, user: User, body: unknown): Promise<{ deleted: true }> {
  const member = await deps.db.getMembership(user.id)
  const isOwner = member?.role === 'owner'
  const typed = (body as { confirmation?: unknown } | null)?.confirmation
  if (!same(typed, isOwner ? member.salonName : CONFIRM_WORD)) throw mismatch()

  // quem avisar precisa ser lido antes de apagar
  const contacts = isOwner ? await deps.db.contactsOf(member.salonId) : null
  let hadCard = false
  if (isOwner) ({ hadCard } = await wipeSalon(deps, member.salonId))
  else if (member) await deps.db.leaveSalon(member.salonId, user.id)
  await deps.db.deleteUser(user.id)

  await notify(deps, user.email, 'self', member?.salonName ?? '', hadCard)
  for (const to of contacts?.memberEmails ?? []) await notify(deps, to, 'member', member?.salonName ?? '', false)
  return { deleted: true }
}

/** lista de e-mails master (ADMIN_EMAILS, separados por vírgula), em minúsculas */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** é master: e-mail na lista e confirmado no login */
export async function isAdmin(db: Pick<AccountDb, 'emailVerified'>, admins: Set<string>, user: User): Promise<boolean> {
  if (!user.email || !admins.has(user.email.toLowerCase())) return false
  return db.emailVerified(user.id)
}

async function requireAdmin(deps: AccountDeps, admins: Set<string>, user: User) {
  if (!(await isAdmin(deps.db, admins, user))) throw new HttpError(403, 'forbidden', 'Acesso restrito.')
}

export async function adminListSalons(deps: AccountDeps, admins: Set<string>, user: User): Promise<{ salons: AdminSalon[] }> {
  await requireAdmin(deps, admins, user)
  return { salons: await deps.db.listSalons() }
}

/** master apaga um negócio e o login da dona, digitando o endereço do negócio; o próprio negócio não se apaga por aqui (para isso existe o Excluir conta) */
export async function adminDeleteSalon(deps: AccountDeps, admins: Set<string>, user: User, body: unknown): Promise<{ deleted: true }> {
  await requireAdmin(deps, admins, user)
  const salonId = (body as { salonId?: unknown } | null)?.salonId
  if (typeof salonId !== 'string' || !UUID.test(salonId)) throw new HttpError(400, 'invalid_input', 'Negócio inválido.')
  const info = await deps.db.salonInfo(salonId)
  if (!info) throw new HttpError(404, 'not_found', 'Negócio não encontrado.')
  if (!same((body as { confirmation?: unknown }).confirmation, info.slug)) throw mismatch()
  const owner = await deps.db.ownerOf(salonId)
  if (owner === user.id) throw new HttpError(400, 'own_salon', 'Para apagar o seu próprio negócio, use Excluir conta.')

  const contacts = await deps.db.contactsOf(salonId)
  const { hadCard } = await wipeSalon(deps, salonId)
  if (owner) await deps.db.deleteUser(owner)

  await notify(deps, contacts.ownerEmail, 'by-admin', info.name, hadCard)
  for (const to of contacts.memberEmails) await notify(deps, to, 'member', info.name, false)
  return { deleted: true }
}

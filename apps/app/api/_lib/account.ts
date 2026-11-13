import { HttpError, type Membership } from './billing.js'

/**
 * excluir a conta (LGPD) e o acesso master da IKIZY.
 *
 * Dona: cancela a cobrança no Stripe (apagando o cliente de lá), apaga o negócio inteiro (clientes, agenda, caixa,
 * site, equipe, convites) e as fotos da loja, e por fim o login. Quem é da equipe: sai do negócio e o login é apagado.
 * Master: e-mails em ADMIN_EMAILS (só no servidor) veem todos os negócios e podem apagar um deles do mesmo jeito.
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
}

export interface User {
  id: string
  email?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** apaga um negócio de ponta a ponta; a cobrança vem primeiro, para nunca sobrar assinatura cobrando um negócio que não existe */
export async function wipeSalon(deps: AccountDeps, salonId: string): Promise<void> {
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
}

/** a pessoa logada apaga a própria conta; `confirm` tem que vir true (a tela pede para digitar o nome antes) */
export async function deleteAccount(deps: AccountDeps, user: User, body: unknown): Promise<{ deleted: true }> {
  if ((body as { confirm?: unknown } | null)?.confirm !== true) {
    throw new HttpError(400, 'confirm_required', 'Confirme a exclusão para continuar.')
  }
  const member = await deps.db.getMembership(user.id)
  if (member?.role === 'owner') await wipeSalon(deps, member.salonId)
  else if (member) await deps.db.leaveSalon(member.salonId, user.id)
  await deps.db.deleteUser(user.id)
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

/** master apaga um negócio e o login da dona; não deixa apagar o próprio negócio por aqui (para isso existe o Excluir conta) */
export async function adminDeleteSalon(deps: AccountDeps, admins: Set<string>, user: User, body: unknown): Promise<{ deleted: true }> {
  await requireAdmin(deps, admins, user)
  const salonId = (body as { salonId?: unknown } | null)?.salonId
  if (typeof salonId !== 'string' || !UUID.test(salonId)) throw new HttpError(400, 'invalid_input', 'Negócio inválido.')
  const owner = await deps.db.ownerOf(salonId)
  if (owner === user.id) throw new HttpError(400, 'own_salon', 'Para apagar o seu próprio negócio, use Excluir conta.')
  await wipeSalon(deps, salonId)
  if (owner) await deps.db.deleteUser(owner)
  return { deleted: true }
}

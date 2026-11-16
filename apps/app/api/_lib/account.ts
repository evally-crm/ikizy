import { renderClosedEmail, renderScheduledEmail, type ClosedKind } from './accountEmail.js'
import { HttpError, type Membership } from './billing.js'
import { reportError } from './monitoring.js'
import type { SendEmail } from './reminders.js'

/**
 * excluir a conta (LGPD) e o acesso master da IKIZY.
 *
 * Dona: o pedido não apaga na hora. O negócio fica "agendado para exclusão" por 7 dias (ela pode desistir) e a tarefa
 * diária (housekeeping.ts) apaga de vez: cobrança no Stripe, negócio inteiro, fotos e login. Quem é da equipe: sai do
 * negócio e o login é apagado na hora (não há dado do negócio em jogo).
 * Master: e-mails em ADMIN_EMAILS (só no servidor) veem todos os negócios e apagam um deles na hora, com registro.
 * Quem pede precisa mandar o texto de confirmação, e o servidor confere (não basta ter um token válido).
 * Tudo que apaga ou agenda deixa uma linha no `audit_log`, e a pessoa recebe um e-mail.
 */

/** dias entre o pedido da dona e a exclusão de verdade */
export const GRACE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export interface AuditEntry {
  actorKind: 'admin' | 'owner' | 'system'
  actorId?: string | null
  actorEmail?: string | null
  /** ex.: 'admin.delete_salon', 'owner.request_deletion', 'system.purge_salon' */
  action: string
  salonId?: string | null
  salonName?: string | null
  salonSlug?: string | null
  /** só o que ajuda a entender depois (nunca dado de cliente) */
  details?: Record<string, unknown>
}

export interface AuditRow {
  id: number
  at: string
  actorKind: string
  actorEmail: string | null
  action: string
  salonName: string | null
  salonSlug: string | null
  details: Record<string, unknown>
}

export interface SalonInfo {
  name: string
  slug: string
  deletionScheduledAt: Date | null
  /** a cobrança no cartão foi pausada só por causa do pedido de exclusão (volta se ela desistir) */
  resumeBilling: boolean
}

export interface AccountDb {
  getMembership(userId: string): Promise<Membership | null>
  /** cliente do Stripe do negócio (null se nunca pagou no cartão nem no Pix) */
  stripeCustomer(salonId: string): Promise<string | null>
  /** assinatura no cartão do negócio, se houver */
  cardSubscription(salonId: string): Promise<{ subscriptionId: string; cancelAtPeriodEnd: boolean } | null>
  /** apaga o negócio e tudo que pende dele, numa transação só (com o registro, se vier) */
  deleteSalon(salonId: string, audit?: AuditEntry): Promise<void>
  /** tira a pessoa da equipe (o atendimento dela continua, sem login ligado) */
  leaveSalon(salonId: string, userId: string): Promise<void>
  /** apaga o login (sessões e contas ligadas caem junto) */
  deleteUser(userId: string): Promise<void>
  /** dona do negócio (para apagar o login dela junto) */
  ownerOf(salonId: string): Promise<string | null>
  /** o e-mail do login foi confirmado? (o master só vale com e-mail confirmado) */
  emailVerified(userId: string): Promise<boolean>
  listSalons(): Promise<AdminSalon[]>
  salonInfo(salonId: string): Promise<SalonInfo | null>
  /** e-mails de quem tem login no negócio; precisa ser lido ANTES de apagar */
  contactsOf(salonId: string): Promise<{ ownerEmail: string | null; memberEmails: string[] }>
  /** quanto há no negócio (para a dona ver o que vai perder antes de confirmar) */
  salonCounts(salonId: string): Promise<{ clients: number; appointments: number; members: number }>
  scheduleDeletion(salonId: string, requestedAt: Date, scheduledAt: Date, resumeBilling: boolean): Promise<void>
  cancelDeletion(salonId: string): Promise<void>
  /** negócios cujo prazo de exclusão já passou */
  dueDeletions(now: Date): Promise<{ salonId: string; name: string; slug: string }[]>
  audit(entry: AuditEntry): Promise<void>
  listAudit(limit: number): Promise<AuditRow[]>
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
  /** quando a exclusão pedida pela dona acontece (null = não há pedido) */
  deletionScheduledAt: string | null
}

export interface AccountDeps {
  db: AccountDb
  /** apaga o cliente no Stripe (cancela na hora qualquer assinatura dele) */
  deleteCustomer: (customerId: string) => Promise<void>
  /** liga ou desliga o cancelamento no fim do período de uma assinatura no cartão */
  setCancelAtPeriodEnd: (subscriptionId: string, value: boolean) => Promise<void>
  /** apaga da loja tudo que começa com o prefixo */
  deletePhotos: (prefix: string) => Promise<void>
  /** e-mail de aviso (um erro aqui nunca desfaz nem trava a ação) */
  send: SendEmail
  /** endereço do app, para o link dos e-mails */
  appUrl: string
  now?: () => Date
}

export interface User {
  id: string
  email?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** motivos que a dona pode marcar ao pedir a exclusão (opcional; vira dado de melhoria do produto, sem nome de cliente) */
export const REASONS = ['nao-uso', 'caro', 'faltam-recursos', 'dificil', 'outro-sistema', 'fechei', 'outro'] as const
export type Reason = (typeof REASONS)[number]

/** lê o motivo e o comentário do corpo do pedido: o que não for da lista é ignorado, e o comentário tem teto de 300 letras */
export function parseReason(body: unknown): { reason: Reason | null; comment: string | null } {
  const b = (body ?? {}) as { reason?: unknown; comment?: unknown }
  const reason = REASONS.find((r) => r === b.reason) ?? null
  const comment = typeof b.comment === 'string' ? b.comment.trim().slice(0, 300) : ''
  return { reason, comment: reason && comment ? comment : null }
}

/** o que quem não é dona digita para confirmar (a dona digita o nome do negócio; o master, o endereço dele) */
export const CONFIRM_WORD = 'excluir'

const same = (typed: unknown, expected: string) => typeof typed === 'string' && typed.trim().toLowerCase() === expected.trim().toLowerCase()

const mismatch = () => new HttpError(400, 'confirm_mismatch', 'O texto digitado não confere. Confira e tente de novo.')

const clock = (deps: AccountDeps) => (deps.now ?? (() => new Date()))()

/** manda o aviso sem nunca derrubar a ação (que já aconteceu); o destino vem do banco ou do token, não do corpo da chamada */
export async function notify(deps: Pick<AccountDeps, 'send'>, to: string | null | undefined, mail: { subject: string; html: string; text: string }) {
  if (!to) return
  try {
    await deps.send({ to, ...mail })
  } catch (error) {
    reportError(error, 'aviso de conta')
  }
}

export const closedMail = (kind: ClosedKind, salonName: string, hadCard: boolean) => renderClosedEmail(kind, salonName, hadCard)

/** o registro nunca derruba a ação principal já feita (mas vai para o monitoramento) */
async function record(deps: AccountDeps, entry: AuditEntry) {
  try {
    await deps.db.audit(entry)
  } catch (error) {
    reportError(error, 'registro de ação')
  }
}

/** apaga um negócio de ponta a ponta; a cobrança vem primeiro, para nunca sobrar assinatura cobrando um negócio que não existe */
export async function wipeSalon(deps: AccountDeps, salonId: string, audit?: AuditEntry): Promise<{ hadCard: boolean }> {
  const customer = await deps.db.stripeCustomer(salonId)
  if (customer) {
    try {
      await deps.deleteCustomer(customer)
    } catch (error) {
      // cliente já apagado no Stripe: segue; qualquer outra falha para tudo (melhor não apagar do que deixar cobrando)
      if ((error as { code?: string }).code !== 'resource_missing') throw error
    }
  }
  await deps.db.deleteSalon(salonId, audit)
  // as fotos que sobrarem a limpeza diária apaga (o banco não aponta mais para elas)
  await deps.deletePhotos(`salons/${salonId}/`).catch(() => undefined)
  return { hadCard: Boolean(customer) }
}

export type DeleteResult = { deleted: true } | { scheduled: string }

/**
 * a pessoa logada pede para apagar a própria conta; o servidor confere o texto digitado: nome do negócio (dona) ou "excluir" (os demais).
 * Dona: agenda para daqui a 7 dias (pausa a cobrança no cartão) e responde com a data. Os demais: apaga na hora.
 */
export async function deleteAccount(deps: AccountDeps, user: User, body: unknown): Promise<DeleteResult> {
  const member = await deps.db.getMembership(user.id)
  const isOwner = member?.role === 'owner'
  const typed = (body as { confirmation?: unknown } | null)?.confirmation
  if (!same(typed, isOwner ? member.salonName : CONFIRM_WORD)) throw mismatch()

  if (isOwner) return requestDeletion(deps, user, member, parseReason(body))

  if (member) await deps.db.leaveSalon(member.salonId, user.id)
  await deps.db.deleteUser(user.id)
  await notify(deps, user.email, renderClosedEmail('self', member?.salonName ?? '', false))
  return { deleted: true }
}

async function requestDeletion(deps: AccountDeps, user: User, member: Membership, why: { reason: Reason | null; comment: string | null }): Promise<DeleteResult> {
  const info = await deps.db.salonInfo(member.salonId)
  if (!info) throw new HttpError(404, 'not_found', 'Negócio não encontrado.')
  // pedido repetido: devolve a data que já está valendo, sem mexer em nada
  if (info.deletionScheduledAt) return { scheduled: info.deletionScheduledAt.toISOString() }

  const now = clock(deps)
  const scheduledAt = new Date(now.getTime() + GRACE_DAYS * DAY_MS)

  // cartão ativo e que renovaria: pausa a renovação (cancela no fim do período) para não cobrar um negócio que vai sumir
  const card = await deps.db.cardSubscription(member.salonId)
  const resume = Boolean(card && !card.cancelAtPeriodEnd)
  if (card && resume) await deps.setCancelAtPeriodEnd(card.subscriptionId, true)

  await deps.db.scheduleDeletion(member.salonId, now, scheduledAt, resume)
  await record(deps, {
    actorKind: 'owner',
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: 'owner.request_deletion',
    salonId: member.salonId,
    salonName: info.name,
    salonSlug: info.slug,
    details: { scheduledAt: scheduledAt.toISOString(), billingPaused: resume, ...(why.reason ? { reason: why.reason } : {}), ...(why.comment ? { comment: why.comment } : {}) },
  })
  await notify(deps, user.email, renderScheduledEmail(info.name, scheduledAt, `${deps.appUrl}/dashboard/conta`))
  return { scheduled: scheduledAt.toISOString() }
}

/** a dona desiste da exclusão agendada: o negócio segue e a cobrança no cartão volta ao normal */
export async function cancelDeletion(deps: AccountDeps, user: User): Promise<{ cancelled: true }> {
  const member = await deps.db.getMembership(user.id)
  if (member?.role !== 'owner') throw new HttpError(403, 'forbidden', 'Só a dona pode cancelar a exclusão.')
  const info = await deps.db.salonInfo(member.salonId)
  if (!info?.deletionScheduledAt) throw new HttpError(400, 'not_scheduled', 'Não há exclusão agendada.')

  // não depende do `cancelAtPeriodEnd` do banco: ele só muda quando o webhook do Stripe chega, e se ela desistir logo
  // depois de pedir ele ainda estaria "falso" e a renovação ficaria pausada para sempre. Desligar é seguro repetir.
  if (info.resumeBilling) {
    const card = await deps.db.cardSubscription(member.salonId)
    if (card) await deps.setCancelAtPeriodEnd(card.subscriptionId, false)
  }
  await deps.db.cancelDeletion(member.salonId)
  await record(deps, {
    actorKind: 'owner',
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: 'owner.cancel_deletion',
    salonId: member.salonId,
    salonName: info.name,
    salonSlug: info.slug,
  })
  return { cancelled: true }
}

export interface AccountSummary {
  role: Membership['role'] | null
  salonName: string | null
  /** só para a dona: quanto o negócio tem hoje */
  clients: number
  appointments: number
  members: number
  /** quando a exclusão acontece (null = nada agendado) */
  deletionAt: string | null
}

/** o que a tela "Excluir conta" mostra antes de a pessoa confirmar: o que ela vai perder */
export async function accountSummary(db: AccountDb, userId: string): Promise<AccountSummary> {
  const member = await db.getMembership(userId)
  const empty = { clients: 0, appointments: 0, members: 0, deletionAt: null }
  if (!member) return { role: null, salonName: null, ...empty }
  if (member.role !== 'owner') return { role: member.role as Membership['role'], salonName: member.salonName, ...empty }
  const [counts, info] = await Promise.all([db.salonCounts(member.salonId), db.salonInfo(member.salonId)])
  return { role: 'owner', salonName: member.salonName, ...counts, deletionAt: info?.deletionScheduledAt?.toISOString() ?? null }
}

/** a dona logada: quando a exclusão dela acontece (null = nada agendado ou não é dona) */
export async function deletionStatus(db: AccountDb, userId: string): Promise<string | null> {
  const member = await db.getMembership(userId)
  if (member?.role !== 'owner') return null
  const info = await db.salonInfo(member.salonId)
  return info?.deletionScheduledAt?.toISOString() ?? null
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

/** o registro das últimas ações (do master, das donas e das limpezas automáticas) */
export async function adminAuditLog(deps: AccountDeps, admins: Set<string>, user: User): Promise<{ log: AuditRow[] }> {
  await requireAdmin(deps, admins, user)
  return { log: await deps.db.listAudit(100) }
}

/** master apaga um negócio e o login da dona na hora, digitando o endereço do negócio; o próprio negócio não se apaga por aqui (para isso existe o Excluir conta) */
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
  const { hadCard } = await wipeSalon(deps, salonId, {
    actorKind: 'admin',
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: 'admin.delete_salon',
    salonId,
    salonName: info.name,
    salonSlug: info.slug,
    details: { ownerDeleted: Boolean(owner) },
  })
  if (owner) await deps.db.deleteUser(owner)

  await notify(deps, contacts.ownerEmail, renderClosedEmail('by-admin', info.name, hadCard))
  for (const to of contacts.memberEmails) await notify(deps, to, renderClosedEmail('member', info.name, false))
  return { deleted: true }
}

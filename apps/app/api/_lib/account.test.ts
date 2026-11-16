import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  accountSummary,
  adminAuditLog,
  adminDeleteSalon,
  adminListSalons,
  cancelDeletion,
  deleteAccount,
  deletionStatus,
  GRACE_DAYS,
  isAdmin,
  parseAdminEmails,
  parseReason,
  type AccountDb,
  type AccountDeps,
  type AuditEntry,
  type SalonInfo,
} from './account.js'
import { HttpError, type Membership } from './billing.js'

const SALON = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-11-16T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

interface Opts {
  member?: Membership | null
  customer?: string | null
  card?: { subscriptionId: string; cancelAtPeriodEnd: boolean } | null
  verified?: boolean
  owner?: string | null
  stripeError?: { code: string }
  sendFails?: boolean
  team?: string[]
  scheduled?: Date | null
  resumeBilling?: boolean
}

function fakeDeps(opts: Opts = {}) {
  const log: string[] = []
  const audits: AuditEntry[] = []
  const state = { scheduled: opts.scheduled ?? null, resume: opts.resumeBilling ?? false }
  const db: AccountDb = {
    async getMembership() {
      return opts.member === undefined ? { salonId: SALON, salonName: 'Studio Maria', role: 'owner' } : opts.member
    },
    async stripeCustomer() {
      return opts.customer === undefined ? 'cus_1' : opts.customer
    },
    async cardSubscription() {
      return opts.card === undefined ? null : opts.card
    },
    async deleteSalon(id, audit) {
      log.push(`deleteSalon:${id}`)
      if (audit) audits.push(audit)
    },
    async leaveSalon(id, user) {
      log.push(`leave:${id}:${user}`)
    },
    async deleteUser(id) {
      log.push(`deleteUser:${id}`)
    },
    async ownerOf() {
      return opts.owner === undefined ? 'owner-1' : opts.owner
    },
    async emailVerified() {
      return opts.verified ?? true
    },
    async listSalons() {
      return []
    },
    async salonInfo(): Promise<SalonInfo> {
      return { name: 'Studio Maria', slug: 'studio-maria', deletionScheduledAt: state.scheduled, resumeBilling: state.resume }
    },
    async contactsOf() {
      return { ownerEmail: 'dona@x.com', memberEmails: opts.team ?? [] }
    },
    async salonCounts() {
      return { clients: 42, appointments: 310, members: 3 }
    },
    async scheduleDeletion(_id, _req, at, resume) {
      log.push(`schedule:${at.toISOString()}:${resume}`)
      state.scheduled = at
      state.resume = resume
    },
    async cancelDeletion() {
      log.push('cancelDeletion')
      state.scheduled = null
      state.resume = false
    },
    async dueDeletions() {
      return []
    },
    async audit(entry) {
      audits.push(entry)
    },
    async listAudit() {
      return []
    },
  }
  const deps: AccountDeps = {
    db,
    async deleteCustomer(id) {
      if (opts.stripeError) throw opts.stripeError
      log.push(`stripe:${id}`)
    },
    async setCancelAtPeriodEnd(id, value) {
      log.push(`cancelAtEnd:${id}:${value}`)
    },
    async deletePhotos(prefix) {
      log.push(`photos:${prefix}`)
    },
    async send(mail) {
      if (opts.sendFails) throw new Error('resend fora do ar')
      log.push(`mail:${mail.to}:${mail.subject}`)
    },
    appUrl: 'https://app.ikizy.com',
    now: () => NOW,
  }
  return { deps, log, audits, state }
}

const rejectsWith = (p: Promise<unknown>, code: string) => assert.rejects(p, (e) => e instanceof HttpError && e.code === code)
const OWNER = { id: 'u1', email: 'dona@x.com' }
const SCHEDULED_AT = new Date(NOW.getTime() + GRACE_DAYS * DAY)
const mails = (log: string[]) => log.filter((l) => l.startsWith('mail:'))

describe('pedir a exclusão (dona)', () => {
  it('sem o texto, ou com texto errado, não faz nada (o servidor confere, não só a tela)', async () => {
    const { deps, log } = fakeDeps()
    await rejectsWith(deleteAccount(deps, OWNER, {}), 'confirm_mismatch')
    await rejectsWith(deleteAccount(deps, OWNER, null), 'confirm_mismatch')
    await rejectsWith(deleteAccount(deps, OWNER, { confirm: true }), 'confirm_mismatch')
    await rejectsWith(deleteAccount(deps, OWNER, { confirmation: 'outro nome' }), 'confirm_mismatch')
    await rejectsWith(deleteAccount(deps, OWNER, { confirmation: 'excluir' }), 'confirm_mismatch')
    assert.deepEqual(log, [])
  })

  it('agenda para daqui a 7 dias, não apaga nada na hora, registra e avisa por e-mail', async () => {
    const { deps, log, audits } = fakeDeps()
    const out = await deleteAccount(deps, OWNER, { confirmation: '  studio maria ' })
    assert.deepEqual(out, { scheduled: SCHEDULED_AT.toISOString() })
    assert.deepEqual(log, [`schedule:${SCHEDULED_AT.toISOString()}:false`, `mail:dona@x.com:Exclusão da sua conta agendada para ${SCHEDULED_AT.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`])
    assert.equal(log.some((l) => l.startsWith('deleteSalon') || l.startsWith('deleteUser') || l.startsWith('stripe')), false)
    assert.equal(audits[0].action, 'owner.request_deletion')
    assert.equal(audits[0].actorKind, 'owner')
  })

  it('cartão que renovaria: pausa a renovação antes de agendar e lembra que pausou', async () => {
    const { deps, log } = fakeDeps({ card: { subscriptionId: 'sub_1', cancelAtPeriodEnd: false } })
    await deleteAccount(deps, OWNER, { confirmation: 'Studio Maria' })
    assert.equal(log[0], 'cancelAtEnd:sub_1:true')
    assert.equal(log[1], `schedule:${SCHEDULED_AT.toISOString()}:true`)
  })

  it('cartão que já ia cancelar: não mexe no Stripe e não marca para retomar', async () => {
    const { deps, log } = fakeDeps({ card: { subscriptionId: 'sub_1', cancelAtPeriodEnd: true } })
    await deleteAccount(deps, OWNER, { confirmation: 'Studio Maria' })
    assert.equal(log.some((l) => l.startsWith('cancelAtEnd')), false)
    assert.equal(log[0], `schedule:${SCHEDULED_AT.toISOString()}:false`)
  })

  it('falha ao pausar a cobrança: não agenda nada', async () => {
    const { deps, log } = fakeDeps({ card: { subscriptionId: 'sub_1', cancelAtPeriodEnd: false } })
    deps.setCancelAtPeriodEnd = async () => {
      throw new Error('stripe fora do ar')
    }
    await assert.rejects(deleteAccount(deps, OWNER, { confirmation: 'Studio Maria' }))
    assert.deepEqual(log, [])
  })

  it('pedido repetido devolve a data que já vale, sem mexer em nada', async () => {
    const { deps, log } = fakeDeps({ scheduled: SCHEDULED_AT })
    const out = await deleteAccount(deps, OWNER, { confirmation: 'Studio Maria' })
    assert.deepEqual(out, { scheduled: SCHEDULED_AT.toISOString() })
    assert.deepEqual(log, [])
  })

  it('erro no envio do aviso não desfaz o agendamento', async () => {
    const { deps, state } = fakeDeps({ sendFails: true })
    await deleteAccount(deps, OWNER, { confirmation: 'Studio Maria' })
    assert.deepEqual(state.scheduled, SCHEDULED_AT)
  })
})

describe('motivo da exclusão', () => {
  it('lê só motivos da lista e corta o comentário em 300 letras', () => {
    assert.deepEqual(parseReason({ reason: 'caro', comment: '  achei caro  ' }), { reason: 'caro', comment: 'achei caro' })
    assert.deepEqual(parseReason({ reason: 'inventado', comment: 'x' }), { reason: null, comment: null })
    assert.deepEqual(parseReason({ comment: 'sem motivo' }), { reason: null, comment: null })
    assert.deepEqual(parseReason(null), { reason: null, comment: null })
    assert.equal(parseReason({ reason: 'outro', comment: 'a'.repeat(900) }).comment?.length, 300)
    assert.deepEqual(parseReason({ reason: 'fechei', comment: 42 }), { reason: 'fechei', comment: null })
  })

  it('o motivo vai para o registro do pedido; sem motivo, o pedido vale igual', async () => {
    const withReason = fakeDeps()
    await deleteAccount(withReason.deps, OWNER, { confirmation: 'Studio Maria', reason: 'caro', comment: 'preço' })
    assert.equal(withReason.audits[0].details?.reason, 'caro')
    assert.equal(withReason.audits[0].details?.comment, 'preço')
    const without = fakeDeps()
    await deleteAccount(without.deps, OWNER, { confirmation: 'Studio Maria' })
    assert.equal('reason' in (without.audits[0].details ?? {}), false)
  })

  it('motivo fora da lista é ignorado, não bloqueia', async () => {
    const { deps, audits } = fakeDeps()
    await deleteAccount(deps, OWNER, { confirmation: 'Studio Maria', reason: '<script>' })
    assert.equal('reason' in (audits[0].details ?? {}), false)
  })
})

describe('resumo para a tela de excluir', () => {
  it('a dona vê quanto vai perder e quando acontece', async () => {
    const out = await accountSummary(fakeDeps({ scheduled: SCHEDULED_AT }).deps.db, 'u1')
    assert.deepEqual(out, { role: 'owner', salonName: 'Studio Maria', clients: 42, appointments: 310, members: 3, deletionAt: SCHEDULED_AT.toISOString() })
  })

  it('equipe e quem não tem negócio não recebem contagem', async () => {
    const team = await accountSummary(fakeDeps({ member: { salonId: SALON, salonName: 'Studio Maria', role: 'reception' } }).deps.db, 'u2')
    assert.deepEqual(team, { role: 'reception', salonName: 'Studio Maria', clients: 0, appointments: 0, members: 0, deletionAt: null })
    const none = await accountSummary(fakeDeps({ member: null }).deps.db, 'u3')
    assert.equal(none.role, null)
  })
})

describe('desistir da exclusão', () => {
  it('só a dona, e só se há exclusão agendada', async () => {
    await rejectsWith(cancelDeletion(fakeDeps({ member: { salonId: SALON, salonName: 'Studio Maria', role: 'professional' } }).deps, OWNER), 'forbidden')
    await rejectsWith(cancelDeletion(fakeDeps().deps, OWNER), 'not_scheduled')
  })

  it('limpa o agendamento e devolve a renovação do cartão que foi pausada', async () => {
    const { deps, log, audits } = fakeDeps({ scheduled: SCHEDULED_AT, resumeBilling: true, card: { subscriptionId: 'sub_1', cancelAtPeriodEnd: true } })
    assert.deepEqual(await cancelDeletion(deps, OWNER), { cancelled: true })
    assert.deepEqual(log, ['cancelAtEnd:sub_1:false', 'cancelDeletion'])
    assert.equal(audits[0].action, 'owner.cancel_deletion')
  })

  it('desistir logo depois de pedir (o webhook do Stripe ainda não chegou) também religa a renovação', async () => {
    const { deps, log } = fakeDeps({ scheduled: SCHEDULED_AT, resumeBilling: true, card: { subscriptionId: 'sub_1', cancelAtPeriodEnd: false } })
    await cancelDeletion(deps, OWNER)
    assert.deepEqual(log, ['cancelAtEnd:sub_1:false', 'cancelDeletion'])
  })

  it('se a pausa era anterior ao pedido, não religa a renovação', async () => {
    const { deps, log } = fakeDeps({ scheduled: SCHEDULED_AT, resumeBilling: false, card: { subscriptionId: 'sub_1', cancelAtPeriodEnd: true } })
    await cancelDeletion(deps, OWNER)
    assert.deepEqual(log, ['cancelDeletion'])
  })

  it('diz à dona quando a exclusão acontece', async () => {
    assert.equal(await deletionStatus(fakeDeps().deps.db, 'u1'), null)
    assert.equal(await deletionStatus(fakeDeps({ scheduled: SCHEDULED_AT }).deps.db, 'u1'), SCHEDULED_AT.toISOString())
    assert.equal(await deletionStatus(fakeDeps({ member: { salonId: SALON, salonName: 'x', role: 'reception' }, scheduled: SCHEDULED_AT }).deps.db, 'u2'), null)
  })
})

describe('excluir conta (equipe e sem negócio)', () => {
  it('equipe: digita "excluir", só sai do negócio e apaga o login na hora', async () => {
    const { deps, log } = fakeDeps({ member: { salonId: SALON, salonName: 'Studio Maria', role: 'professional' } })
    await rejectsWith(deleteAccount(deps, { id: 'u2', email: 'p@x.com' }, { confirmation: 'Studio Maria' }), 'confirm_mismatch')
    assert.deepEqual(await deleteAccount(deps, { id: 'u2', email: 'p@x.com' }, { confirmation: 'Excluir' }), { deleted: true })
    assert.deepEqual(log.slice(0, 2), [`leave:${SALON}:u2`, 'deleteUser:u2'])
    assert.equal(mails(log).length, 1)
  })

  it('sem negócio: só o login', async () => {
    const { deps, log } = fakeDeps({ member: null })
    await deleteAccount(deps, { id: 'u3' }, { confirmation: 'excluir' })
    assert.deepEqual(log, ['deleteUser:u3'])
  })
})

describe('master', () => {
  const admins = parseAdminEmails(' Master@Ikizy.com , outra@x.com,')
  const me = { id: 'a', email: 'master@ikizy.com' }

  it('lê a lista de e-mails sem diferenciar maiúsculas', () => {
    assert.deepEqual([...admins], ['master@ikizy.com', 'outra@x.com'])
  })

  it('só vale com e-mail na lista e confirmado', async () => {
    assert.equal(await isAdmin(fakeDeps().deps.db, admins, { id: 'a', email: 'MASTER@ikizy.com' }), true)
    assert.equal(await isAdmin(fakeDeps({ verified: false }).deps.db, admins, me), false)
    assert.equal(await isAdmin(fakeDeps().deps.db, admins, { id: 'a', email: 'dona@x.com' }), false)
    assert.equal(await isAdmin(fakeDeps().deps.db, admins, { id: 'a' }), false)
  })

  it('quem não é master não lista, não vê o registro e não apaga', async () => {
    const { deps, log } = fakeDeps()
    const other = { id: 'x', email: 'dona@x.com' }
    await rejectsWith(adminListSalons(deps, admins, other), 'forbidden')
    await rejectsWith(adminAuditLog(deps, admins, other), 'forbidden')
    await rejectsWith(adminDeleteSalon(deps, admins, other, { salonId: SALON, confirmation: 'studio-maria' }), 'forbidden')
    assert.deepEqual(log, [])
  })

  it('exige o endereço do negócio digitado', async () => {
    const { deps, log } = fakeDeps()
    await rejectsWith(adminDeleteSalon(deps, admins, me, { salonId: SALON }), 'confirm_mismatch')
    await rejectsWith(adminDeleteSalon(deps, admins, me, { salonId: SALON, confirmation: 'Studio Maria' }), 'confirm_mismatch')
    assert.deepEqual(log, [])
  })

  it('apaga na hora o negócio e o login da dona, deixa registro e avisa dona e equipe', async () => {
    const { deps, log, audits } = fakeDeps({ team: ['a@x.com'] })
    await adminDeleteSalon(deps, admins, me, { salonId: SALON, confirmation: 'STUDIO-MARIA' })
    assert.deepEqual(
      log.filter((l) => !l.startsWith('mail:')),
      ['stripe:cus_1', `deleteSalon:${SALON}`, `photos:salons/${SALON}/`, 'deleteUser:owner-1'],
    )
    assert.equal(mails(log).length, 2)
    assert.equal(audits.length, 1)
    assert.equal(audits[0].action, 'admin.delete_salon')
    assert.equal(audits[0].actorEmail, 'master@ikizy.com')
    assert.equal(audits[0].salonSlug, 'studio-maria')
  })

  it('não apaga o próprio negócio por aqui nem aceita id inválido', async () => {
    await rejectsWith(adminDeleteSalon(fakeDeps({ owner: 'a' }).deps, admins, me, { salonId: SALON, confirmation: 'studio-maria' }), 'own_salon')
    await rejectsWith(adminDeleteSalon(fakeDeps().deps, admins, me, { salonId: 'x; drop', confirmation: 'x' }), 'invalid_input')
  })

  it('falha no Stripe: não apaga nada e não registra', async () => {
    const { deps, log, audits } = fakeDeps({ stripeError: { code: 'api_error' } })
    await assert.rejects(adminDeleteSalon(deps, admins, me, { salonId: SALON, confirmation: 'studio-maria' }))
    assert.deepEqual(log, [])
    assert.deepEqual(audits, [])
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { adminDeleteSalon, adminListSalons, deleteAccount, isAdmin, parseAdminEmails, type AccountDb, type AccountDeps } from './account.js'
import { HttpError, type Membership } from './billing.js'

const SALON = '11111111-1111-4111-8111-111111111111'

function fakeDeps(
  opts: {
    member?: Membership | null
    customer?: string | null
    verified?: boolean
    owner?: string | null
    stripeError?: { code: string }
    sendFails?: boolean
    team?: string[]
  } = {},
) {
  const log: string[] = []
  const db: AccountDb = {
    async getMembership() {
      return opts.member === undefined ? { salonId: SALON, salonName: 'Studio Maria', role: 'owner' } : opts.member
    },
    async stripeCustomer() {
      return opts.customer === undefined ? 'cus_1' : opts.customer
    },
    async deleteSalon(id) {
      log.push(`deleteSalon:${id}`)
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
    async salonInfo() {
      return { name: 'Studio Maria', slug: 'studio-maria' }
    },
    async contactsOf() {
      return { ownerEmail: 'dona@x.com', memberEmails: opts.team ?? [] }
    },
  }
  const deps: AccountDeps = {
    db,
    async deleteCustomer(id) {
      if (opts.stripeError) throw opts.stripeError
      log.push(`stripe:${id}`)
    },
    async deletePhotos(prefix) {
      log.push(`photos:${prefix}`)
    },
    async send(mail) {
      if (opts.sendFails) throw new Error('resend fora do ar')
      log.push(`mail:${mail.to}:${mail.subject}`)
    },
  }
  return { deps, log }
}

const rejectsWith = (p: Promise<unknown>, code: string) => assert.rejects(p, (e) => e instanceof HttpError && e.code === code)
const OWNER = { id: 'u1', email: 'dona@x.com' }
const CLOSED = 'Sua conta do IKIZY foi excluída'

describe('excluir conta', () => {
  it('sem o texto, ou com texto errado, não apaga nada (o servidor confere, não só a tela)', async () => {
    const { deps, log } = fakeDeps()
    await rejectsWith(deleteAccount(deps, OWNER, {}), 'confirm_mismatch')
    await rejectsWith(deleteAccount(deps, OWNER, null), 'confirm_mismatch')
    await rejectsWith(deleteAccount(deps, OWNER, { confirm: true }), 'confirm_mismatch')
    await rejectsWith(deleteAccount(deps, OWNER, { confirmation: 'outro nome' }), 'confirm_mismatch')
    await rejectsWith(deleteAccount(deps, OWNER, { confirmation: 'excluir' }), 'confirm_mismatch')
    assert.deepEqual(log, [])
  })

  it('dona: cancela no Stripe antes de apagar o negócio, as fotos e o login, e avisa por e-mail', async () => {
    const { deps, log } = fakeDeps()
    await deleteAccount(deps, OWNER, { confirmation: '  studio maria ' })
    assert.deepEqual(log, ['stripe:cus_1', `deleteSalon:${SALON}`, `photos:salons/${SALON}/`, 'deleteUser:u1', `mail:dona@x.com:${CLOSED}`])
  })

  it('dona: a equipe que perdeu o acesso também é avisada', async () => {
    const { deps, log } = fakeDeps({ team: ['a@x.com', 'b@x.com'] })
    await deleteAccount(deps, OWNER, { confirmation: 'Studio Maria' })
    assert.deepEqual(
      log.filter((l) => l.startsWith('mail:')),
      [`mail:dona@x.com:${CLOSED}`, 'mail:a@x.com:Studio Maria foi encerrado no IKIZY', 'mail:b@x.com:Studio Maria foi encerrado no IKIZY'],
    )
  })

  it('erro no envio do aviso não desfaz nem trava a exclusão', async () => {
    const { deps, log } = fakeDeps({ sendFails: true })
    const out = await deleteAccount(deps, OWNER, { confirmation: 'Studio Maria' })
    assert.deepEqual(out, { deleted: true })
    assert.ok(log.includes('deleteUser:u1'))
  })

  it('dona sem cliente no Stripe: apaga sem chamar o Stripe', async () => {
    const { deps, log } = fakeDeps({ customer: null })
    await deleteAccount(deps, OWNER, { confirmation: 'Studio Maria' })
    assert.equal(log[0], `deleteSalon:${SALON}`)
  })

  it('cliente já apagado no Stripe: segue', async () => {
    const { deps, log } = fakeDeps({ stripeError: { code: 'resource_missing' } })
    await deleteAccount(deps, OWNER, { confirmation: 'Studio Maria' })
    assert.ok(log.includes('deleteUser:u1'))
  })

  it('falha no Stripe: não apaga nada', async () => {
    const { deps, log } = fakeDeps({ stripeError: { code: 'api_error' } })
    await assert.rejects(deleteAccount(deps, OWNER, { confirmation: 'Studio Maria' }))
    assert.deepEqual(log, [])
  })

  it('equipe: digita "excluir", só sai do negócio e apaga o login', async () => {
    const { deps, log } = fakeDeps({ member: { salonId: SALON, salonName: 'Studio Maria', role: 'professional' } })
    await rejectsWith(deleteAccount(deps, { id: 'u2', email: 'p@x.com' }, { confirmation: 'Studio Maria' }), 'confirm_mismatch')
    await deleteAccount(deps, { id: 'u2', email: 'p@x.com' }, { confirmation: 'Excluir' })
    assert.deepEqual(log, [`leave:${SALON}:u2`, 'deleteUser:u2', `mail:p@x.com:${CLOSED}`])
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

  it('quem não é master não lista nem apaga', async () => {
    const { deps, log } = fakeDeps()
    const other = { id: 'x', email: 'dona@x.com' }
    await rejectsWith(adminListSalons(deps, admins, other), 'forbidden')
    await rejectsWith(adminDeleteSalon(deps, admins, other, { salonId: SALON, confirmation: 'studio-maria' }), 'forbidden')
    assert.deepEqual(log, [])
  })

  it('exige o endereço do negócio digitado', async () => {
    const { deps, log } = fakeDeps()
    await rejectsWith(adminDeleteSalon(deps, admins, me, { salonId: SALON }), 'confirm_mismatch')
    await rejectsWith(adminDeleteSalon(deps, admins, me, { salonId: SALON, confirmation: 'Studio Maria' }), 'confirm_mismatch')
    assert.deepEqual(log, [])
  })

  it('apaga o negócio e o login da dona e avisa dona e equipe', async () => {
    const { deps, log } = fakeDeps({ team: ['a@x.com'] })
    await adminDeleteSalon(deps, admins, me, { salonId: SALON, confirmation: 'STUDIO-MARIA' })
    assert.deepEqual(log, [
      'stripe:cus_1',
      `deleteSalon:${SALON}`,
      `photos:salons/${SALON}/`,
      'deleteUser:owner-1',
      `mail:dona@x.com:${CLOSED}`,
      'mail:a@x.com:Studio Maria foi encerrado no IKIZY',
    ])
  })

  it('não apaga o próprio negócio por aqui nem aceita id inválido', async () => {
    await rejectsWith(adminDeleteSalon(fakeDeps({ owner: 'a' }).deps, admins, me, { salonId: SALON, confirmation: 'studio-maria' }), 'own_salon')
    await rejectsWith(adminDeleteSalon(fakeDeps().deps, admins, me, { salonId: 'x; drop', confirmation: 'x' }), 'invalid_input')
  })
})

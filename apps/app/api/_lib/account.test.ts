import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { adminDeleteSalon, adminListSalons, deleteAccount, isAdmin, parseAdminEmails, type AccountDb, type AccountDeps } from './account.js'
import { HttpError, type Membership } from './billing.js'

const SALON = '11111111-1111-4111-8111-111111111111'

function fakeDeps(opts: { member?: Membership | null; customer?: string | null; verified?: boolean; owner?: string | null; stripeError?: { code: string } } = {}) {
  const log: string[] = []
  const db: AccountDb = {
    async getMembership() {
      return opts.member === undefined ? { salonId: SALON, salonName: 'Studio', role: 'owner' } : opts.member
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
  }
  return { deps, log }
}

const rejectsWith = (p: Promise<unknown>, code: string) => assert.rejects(p, (e) => e instanceof HttpError && e.code === code)

describe('excluir conta', () => {
  it('exige confirmação', async () => {
    const { deps, log } = fakeDeps()
    await rejectsWith(deleteAccount(deps, { id: 'u1' }, {}), 'confirm_required')
    assert.deepEqual(log, [])
  })

  it('dona: cancela no Stripe antes de apagar o negócio, as fotos e o login', async () => {
    const { deps, log } = fakeDeps()
    await deleteAccount(deps, { id: 'u1' }, { confirm: true })
    assert.deepEqual(log, ['stripe:cus_1', `deleteSalon:${SALON}`, `photos:salons/${SALON}/`, 'deleteUser:u1'])
  })

  it('dona sem cliente no Stripe: apaga sem chamar o Stripe', async () => {
    const { deps, log } = fakeDeps({ customer: null })
    await deleteAccount(deps, { id: 'u1' }, { confirm: true })
    assert.equal(log[0], `deleteSalon:${SALON}`)
  })

  it('cliente já apagado no Stripe: segue', async () => {
    const { deps, log } = fakeDeps({ stripeError: { code: 'resource_missing' } })
    await deleteAccount(deps, { id: 'u1' }, { confirm: true })
    assert.ok(log.includes('deleteUser:u1'))
  })

  it('falha no Stripe: não apaga nada', async () => {
    const { deps, log } = fakeDeps({ stripeError: { code: 'api_error' } })
    await assert.rejects(deleteAccount(deps, { id: 'u1' }, { confirm: true }))
    assert.deepEqual(log, [])
  })

  it('equipe: só sai do negócio e apaga o login', async () => {
    const { deps, log } = fakeDeps({ member: { salonId: SALON, salonName: 'Studio', role: 'professional' } })
    await deleteAccount(deps, { id: 'u2' }, { confirm: true })
    assert.deepEqual(log, [`leave:${SALON}:u2`, 'deleteUser:u2'])
  })

  it('sem negócio: só o login', async () => {
    const { deps, log } = fakeDeps({ member: null })
    await deleteAccount(deps, { id: 'u3' }, { confirm: true })
    assert.deepEqual(log, ['deleteUser:u3'])
  })
})

describe('master', () => {
  const admins = parseAdminEmails(' Master@Ikizy.com , outra@x.com,')

  it('lê a lista de e-mails sem diferenciar maiúsculas', () => {
    assert.deepEqual([...admins], ['master@ikizy.com', 'outra@x.com'])
  })

  it('só vale com e-mail na lista e confirmado', async () => {
    assert.equal(await isAdmin(fakeDeps().deps.db, admins, { id: 'a', email: 'MASTER@ikizy.com' }), true)
    assert.equal(await isAdmin(fakeDeps({ verified: false }).deps.db, admins, { id: 'a', email: 'master@ikizy.com' }), false)
    assert.equal(await isAdmin(fakeDeps().deps.db, admins, { id: 'a', email: 'dona@x.com' }), false)
    assert.equal(await isAdmin(fakeDeps().deps.db, admins, { id: 'a' }), false)
  })

  it('quem não é master não lista nem apaga', async () => {
    const { deps, log } = fakeDeps()
    await rejectsWith(adminListSalons(deps, admins, { id: 'x', email: 'dona@x.com' }), 'forbidden')
    await rejectsWith(adminDeleteSalon(deps, admins, { id: 'x', email: 'dona@x.com' }, { salonId: SALON }), 'forbidden')
    assert.deepEqual(log, [])
  })

  it('master apaga o negócio e o login da dona', async () => {
    const { deps, log } = fakeDeps()
    await adminDeleteSalon(deps, admins, { id: 'a', email: 'master@ikizy.com' }, { salonId: SALON })
    assert.deepEqual(log, ['stripe:cus_1', `deleteSalon:${SALON}`, `photos:salons/${SALON}/`, 'deleteUser:owner-1'])
  })

  it('master não apaga o próprio negócio por aqui nem aceita id inválido', async () => {
    const me = { id: 'a', email: 'master@ikizy.com' }
    await rejectsWith(adminDeleteSalon(fakeDeps({ owner: 'a' }).deps, admins, me, { salonId: SALON }), 'own_salon')
    await rejectsWith(adminDeleteSalon(fakeDeps().deps, admins, me, { salonId: 'x; drop' }), 'invalid_input')
  })
})

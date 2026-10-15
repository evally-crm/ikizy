import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planReminders, renderReminderEmail, runReminders, type PlannedReminder, type ReminderCandidate, type ReminderDb } from './reminders.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-12T12:00:00Z')
const inDays = (n: number, from = NOW) => new Date(from.getTime() + n * DAY - 60_000)

const sub = (over: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  salonId: 's1',
  salonName: 'Studio Maria',
  email: 'maria@exemplo.com',
  status: 'trialing',
  method: null,
  cancelAtPeriodEnd: false,
  accessUntil: inDays(7),
  ...over,
})

describe('planReminders', () => {
  it('avisa o teste sem cartão com 7, 3 e 1 dia, um aviso por vez', () => {
    for (const [days, mark] of [[7, 7], [6, 7], [3, 3], [2, 3], [1, 1]] as const) {
      const [r] = planReminders([sub({ accessUntil: inDays(days) })], NOW)
      assert.equal(r.kind, 'trial')
      assert.match(r.key, new RegExp(`:${mark}$`))
    }
    assert.equal(planReminders([sub({ accessUntil: inDays(12) })], NOW).length, 0)
  })

  it('cartão que renova sozinho não recebe aviso de fim, mas cartão recusado sim', () => {
    assert.equal(planReminders([sub({ status: 'active', method: 'card', accessUntil: inDays(2) })], NOW).length, 0)
    const [r] = planReminders([sub({ status: 'past_due', method: 'card', accessUntil: inDays(2) })], NOW)
    assert.equal(r.kind, 'past_due')
  })

  it('Pix e assinatura cancelada avisam o fim do período', () => {
    assert.equal(planReminders([sub({ status: 'active', method: 'pix', accessUntil: inDays(3) })], NOW)[0].kind, 'pix')
    assert.equal(planReminders([sub({ status: 'canceled', method: 'card', accessUntil: inDays(3) })], NOW)[0].kind, 'canceled')
    assert.equal(planReminders([sub({ status: 'active', method: 'card', cancelAtPeriodEnd: true, accessUntil: inDays(3) })], NOW)[0].kind, 'canceled')
  })

  it('avisa que o acesso terminou só nos 3 dias seguintes, e sem e-mail não avisa', () => {
    assert.equal(planReminders([sub({ accessUntil: inDays(-1) })], NOW)[0].kind, 'ended')
    assert.equal(planReminders([sub({ accessUntil: inDays(-5) })], NOW).length, 0)
    assert.equal(planReminders([sub({ email: null })], NOW).length, 0)
  })

  it('a chave muda quando o acesso é renovado (novo período, novo aviso)', () => {
    const later = new Date(NOW.getTime() + 27 * DAY)
    const first = planReminders([sub({ accessUntil: inDays(3) })], NOW)[0].key
    const second = planReminders([sub({ accessUntil: inDays(30) })], later)[0].key
    assert.notEqual(first, second)
  })
})

describe('renderReminderEmail', () => {
  it('traz o link da assinatura e escapa o nome do negócio', () => {
    const [r] = planReminders([sub({ salonName: 'Studio <b>X</b>', accessUntil: inDays(1) })], NOW)
    const mail = renderReminderEmail(r, 'https://app.ikizy.com/dashboard/assinatura')
    assert.match(mail.subject, /amanhã/)
    assert.ok(mail.html.includes('https://app.ikizy.com/dashboard/assinatura'))
    assert.ok(!mail.html.includes('<b>X</b>'))
    assert.ok(mail.text.includes('https://app.ikizy.com/dashboard/assinatura'))
  })
})

describe('runReminders', () => {
  const dbWith = (list: ReminderCandidate[], seen = new Set<string>()): ReminderDb & { released: string[] } => {
    const released: string[] = []
    return {
      released,
      candidates: async () => list,
      claim: async (r: PlannedReminder) => {
        if (seen.has(r.key)) return false
        seen.add(r.key)
        return true
      },
      release: async (key) => {
        seen.delete(key)
        released.push(key)
      },
    }
  }

  it('envia uma vez e não repete na rodada seguinte', async () => {
    const sent: string[] = []
    const seen = new Set<string>()
    const run = () =>
      runReminders({
        db: dbWith([sub({ accessUntil: inDays(3) })], seen),
        send: async (m) => {
          sent.push(m.to)
        },
        link: 'https://x.test',
        now: NOW,
      })
    assert.deepEqual(await run(), { planned: 1, sent: 1, skipped: 0, failed: 0 })
    assert.deepEqual(await run(), { planned: 1, sent: 0, skipped: 1, failed: 0 })
    assert.deepEqual(sent, ['maria@exemplo.com'])
  })

  it('se o envio falha, devolve a reserva para tentar na próxima rodada e segue com os outros', async () => {
    const quiet = console.error
    console.error = () => {}
    try {
      const db = dbWith([sub({ salonId: 'a', accessUntil: inDays(3) }), sub({ salonId: 'b', email: 'b@exemplo.com', accessUntil: inDays(3) })])
      const sent: string[] = []
      const result = await runReminders({
        db,
        send: async (m) => {
          if (m.to === 'maria@exemplo.com') throw new Error('resend 500')
          sent.push(m.to)
        },
        link: 'https://x.test',
        now: NOW,
      })
      assert.deepEqual(result, { planned: 2, sent: 1, skipped: 0, failed: 1 })
      assert.equal(db.released.length, 1)
      assert.deepEqual(sent, ['b@exemplo.com'])
    } finally {
      console.error = quiet
    }
  })
})

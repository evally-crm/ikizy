import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { notifyNewRequest, phoneBR, renderNewRequestEmail, renderWelcomeEmail, sendWelcome, whenBR, type NewRequest, type NotifyDb, type OwnerContact } from './notify.js'

const OWNER: OwnerContact = { salonId: '33333333-3333-4333-8333-333333333333', salonName: 'Studio <Maria>', email: 'dona@exemplo.com' }
const REQ: NewRequest = {
  id: 'abc-123',
  startsAt: '2026-10-20T13:00:00.000Z',
  service: 'Alongamento em gel',
  professional: 'Bia',
  clientName: 'Ana Souza',
  clientPhone: '11999998888',
}

function fakeDb(owner: OwnerContact | null = OWNER, seen = new Set<string>()) {
  const released: string[] = []
  const db: NotifyDb = {
    ownerBySlug: async () => owner,
    recentOwnedSalons: async () => (owner ? [owner] : []),
    claim: async (key) => {
      if (seen.has(key)) return false
      seen.add(key)
      return true
    },
    release: async (key) => {
      seen.delete(key)
      released.push(key)
    },
  }
  return { db, seen, released }
}

const silent = <T>(fn: () => Promise<T>) => {
  const original = console.error
  console.error = () => {}
  return fn().finally(() => {
    console.error = original
  })
}

describe('formatos', () => {
  it('data e hora no fuso de Brasília', () => {
    assert.equal(whenBR('2026-10-20T13:00:00.000Z'), 'terça-feira, 20 de outubro às 10:00')
  })
  it('telefone com DDD, com ou sem o 55', () => {
    assert.equal(phoneBR('11999998888'), '(11) 99999-8888')
    assert.equal(phoneBR('5511999998888'), '(11) 99999-8888')
    assert.equal(phoneBR('1133334444'), '(11) 3333-4444')
  })
})

describe('renderNewRequestEmail', () => {
  it('traz o serviço, o horário, a cliente e o link do pedido, com o nome escapado', () => {
    const mail = renderNewRequestEmail(OWNER.salonName, REQ, 'https://app.ikizy.com/dashboard/agenda?pedido=abc-123')
    assert.match(mail.subject, /Alongamento em gel/)
    assert.ok(mail.html.includes('https://app.ikizy.com/dashboard/agenda?pedido=abc-123'))
    assert.ok(mail.html.includes('(11) 99999-8888'))
    assert.ok(!mail.html.includes('<Maria>'))
    assert.ok(mail.text.includes('Ana Souza'))
  })
})

describe('notifyNewRequest', () => {
  const deps = (db: NotifyDb, sent: unknown[]) => ({ db, send: async (m: unknown) => void sent.push(m), appUrl: 'https://app.ikizy.com' })

  it('manda uma vez só por pedido', async () => {
    const { db } = fakeDb()
    const sent: unknown[] = []
    assert.equal(await notifyNewRequest(deps(db, sent), 'studio', REQ), true)
    assert.equal(await notifyNewRequest(deps(db, sent), 'studio', REQ), false)
    assert.equal(sent.length, 1)
  })

  it('sem e-mail da dona ou sem negócio, não manda nada', async () => {
    const sent: unknown[] = []
    assert.equal(await notifyNewRequest(deps(fakeDb({ ...OWNER, email: null }).db, sent), 'studio', REQ), false)
    assert.equal(await notifyNewRequest(deps(fakeDb(null).db, sent), 'studio', REQ), false)
    assert.equal(sent.length, 0)
  })

  it('se o envio falha, não derruba o pedido e libera a chave para tentar de novo', async () => {
    const { db, released } = fakeDb()
    const ok = await silent(() =>
      notifyNewRequest(
        {
          db,
          send: async () => {
            throw new Error('resend fora do ar')
          },
          appUrl: 'https://app.ikizy.com',
        },
        'studio',
        REQ,
      ),
    )
    assert.equal(ok, false)
    assert.deepEqual(released, ['request:abc-123'])
  })
})

describe('boas-vindas', () => {
  it('manda uma vez por negócio, com o link do painel', async () => {
    const { db } = fakeDb()
    const sent: { html: string }[] = []
    const deps = { db, send: async (m: { html: string }) => void sent.push(m), appUrl: 'https://app.ikizy.com' }
    assert.equal(await sendWelcome(deps, OWNER), true)
    assert.equal(await sendWelcome(deps, OWNER), false)
    assert.equal(sent.length, 1)
    assert.ok(sent[0].html.includes('https://app.ikizy.com/dashboard'))
  })

  it('texto fala do teste e do primeiro passo', () => {
    const mail = renderWelcomeEmail('Studio Maria', 'https://app.ikizy.com/dashboard')
    assert.match(mail.text, /30 dias/)
    assert.match(mail.text, /publique o seu site/)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HttpError } from './billing.js'
import { captureLead, leadWelcomeEmail, parseLeadInput, unsubscribeLead, unsubscribeToken, unsubscribeUrl, type LeadDb } from './lead.js'
import type { SendEmail } from './reminders.js'

function fakeDb(existing: string[] = [], blocked = false) {
  const saved = new Set(existing)
  const welcomed: string[] = []
  const unsubscribed: string[] = []
  const db: LeadDb = {
    limited: async () => blocked,
    save: async (email) => (saved.has(email) ? false : (saved.add(email), true)),
    welcomed: async (email) => void welcomed.push(email),
    unsubscribe: async (email) => void unsubscribed.push(email),
  }
  return { db, saved, welcomed, unsubscribed }
}

const deps = (db: LeadDb, send: SendEmail = async () => {}) => ({ db, send, appUrl: 'https://app.ikizy.com', trialDays: 30 })

describe('lead da landing', () => {
  it('aceita e-mail válido, em minúsculas e sem espaços', () => {
    assert.deepEqual(parseLeadInput({ email: '  Ana@Salao.com.br ' }), { email: 'ana@salao.com.br', honeypot: false })
  })

  it('recusa e-mail inválido com 400', () => {
    for (const email of ['', 'ana', 'ana@', 'ana@salao', 'a b@c.com', 42]) {
      assert.throws(() => parseLeadInput({ email }), (e) => e instanceof HttpError && e.status === 400)
    }
    assert.throws(() => parseLeadInput(null), (e) => e instanceof HttpError && e.status === 400)
  })

  it('e-mail novo: grava, manda a apresentação e marca como enviada', async () => {
    const { db, saved, welcomed } = fakeDb()
    const sent: { to: string; subject: string }[] = []
    await captureLead(deps(db, async (m) => void sent.push(m)), { email: 'ana@salao.com', honeypot: false }, '1.1.1.1')
    assert.ok(saved.has('ana@salao.com'))
    assert.deepEqual(sent.map((m) => m.to), ['ana@salao.com'])
    assert.deepEqual(welcomed, ['ana@salao.com'])
  })

  it('e-mail repetido: não manda de novo', async () => {
    const { db } = fakeDb(['ana@salao.com'])
    let sent = 0
    await captureLead(deps(db, async () => void sent++), { email: 'ana@salao.com', honeypot: false }, '1.1.1.1')
    assert.equal(sent, 0)
  })

  it('robô (campo escondido preenchido): não grava nada', async () => {
    const { db, saved } = fakeDb()
    await captureLead(deps(db), { email: 'bot@x.com', honeypot: true }, '1.1.1.1')
    assert.equal(saved.size, 0)
  })

  it('passou do limite de tentativas: 429', async () => {
    const { db } = fakeDb([], true)
    await assert.rejects(captureLead(deps(db), { email: 'ana@salao.com', honeypot: false }, '1.1.1.1'), (e) => e instanceof HttpError && e.status === 429)
  })

  it('falha no envio não derruba o cadastro', async () => {
    const { db, saved, welcomed } = fakeDb()
    await captureLead(deps(db, async () => Promise.reject(new Error('resend fora'))), { email: 'ana@salao.com', honeypot: false }, '1.1.1.1')
    assert.ok(saved.has('ana@salao.com'))
    assert.deepEqual(welcomed, [])
  })

  it('contato novo avisa quem recebe os avisos; repetido não avisa', async () => {
    const { db } = fakeDb(['velha@salao.com'])
    const sent: string[] = []
    const send: SendEmail = async (m) => void sent.push(m.to)
    await captureLead({ ...deps(db, send), notifyTo: 'equipe@ikizy.com' }, { email: 'nova@salao.com', honeypot: false }, '1.1.1.1')
    await captureLead({ ...deps(db, send), notifyTo: 'equipe@ikizy.com' }, { email: 'velha@salao.com', honeypot: false }, '1.1.1.1')
    assert.deepEqual(sent, ['nova@salao.com', 'equipe@ikizy.com'])
  })

  it('a apresentação leva ao cadastro e cita os dias de teste', () => {
    const m = leadWelcomeEmail('https://app.ikizy.com', 30)
    assert.match(m.text, /30 dias/)
    assert.match(m.html, /https:\/\/app\.ikizy\.com\/cadastro\?origem=email-lead/)
  })
})

describe('sair da lista', () => {
  const SECRET = 'segredo-de-teste'

  it('o e-mail de apresentação leva o link e o cabeçalho de sair; sem segredo, sai sem o link', async () => {
    const { db } = fakeDb()
    const sent: { to: string; html: string; text: string; headers?: Record<string, string> }[] = []
    await captureLead({ ...deps(db, async (m) => void sent.push(m)), secret: SECRET }, { email: 'ana@salao.com', honeypot: false }, '1.1.1.1')
    const url = unsubscribeUrl('https://app.ikizy.com', 'ana@salao.com', SECRET)
    assert.ok(sent[0].html.includes(url.replace(/&/g, '&amp;')))
    assert.match(sent[0].text, /Não quero receber mais/)
    assert.equal(sent[0].headers?.['List-Unsubscribe'], `<${url}>`)
    assert.equal(sent[0].headers?.['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')

    const plain: typeof sent = []
    await captureLead(deps(fakeDb().db, async (m) => void plain.push(m)), { email: 'bia@salao.com', honeypot: false }, '1.1.1.1')
    assert.equal(plain[0].headers, undefined)
    assert.ok(!plain[0].text.includes('Não quero receber'))
  })

  it('link certo tira da lista; link adulterado ou de outro e-mail dá 400', async () => {
    const { db, unsubscribed } = fakeDb()
    await unsubscribeLead(db, 'Ana@Salao.com', unsubscribeToken('ana@salao.com', SECRET), SECRET)
    assert.deepEqual(unsubscribed, ['ana@salao.com'])
    const bad = (e: unknown) => e instanceof HttpError && e.status === 400
    await assert.rejects(() => unsubscribeLead(db, 'ana@salao.com', 'x'.repeat(64), SECRET), bad)
    await assert.rejects(() => unsubscribeLead(db, 'ana@salao.com', '', SECRET), bad)
    await assert.rejects(() => unsubscribeLead(db, 'bia@salao.com', unsubscribeToken('ana@salao.com', SECRET), SECRET), bad)
    assert.equal(unsubscribed.length, 1)
  })
})

describe('sair da lista sem segredo configurado', () => {
  it('recusa mesmo com um token calculado com chave vazia', async () => {
    const { db, unsubscribed } = fakeDb()
    await assert.rejects(() => unsubscribeLead(db, 'ana@salao.com', unsubscribeToken('ana@salao.com', ''), ''), (e) => e instanceof HttpError && e.status === 503)
    assert.equal(unsubscribed.length, 0)
  })
})

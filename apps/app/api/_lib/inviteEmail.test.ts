import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HttpError } from './billing.js'
import {
  MAX_SENDS,
  blockReason,
  parseInviteEmailInput,
  renderInviteEmail,
  resendSender,
  sendInviteEmail,
  type InviteEmailDb,
  type InviteForEmail,
  type OutgoingEmail,
} from './inviteEmail.js'

const NOW = new Date('2026-10-10T12:00:00Z')
const ID = '7f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f'

const invite = (over: Partial<InviteForEmail> = {}): InviteForEmail => ({
  id: ID,
  salonId: 'salon-1',
  salonName: 'Studio <Ana>',
  token: 'a'.repeat(64),
  role: 'professional',
  name: 'Bia Souza',
  email: 'bia@example.com',
  expiresAt: new Date(NOW.getTime() + 5 * 864e5),
  acceptedAt: null,
  emailSentAt: null,
  emailCount: 0,
  ...over,
})

function fakeDb(opts: { member?: { salonId: string; role: string } | null; invite?: InviteForEmail | null; claim?: boolean } = {}) {
  const calls = { claims: 0, releases: 0 }
  const db: InviteEmailDb = {
    getMembership: async () => (opts.member === undefined ? { salonId: 'salon-1', role: 'owner' } : opts.member),
    getInvite: async () => (opts.invite === undefined ? invite() : opts.invite),
    claimSend: async () => {
      calls.claims++
      return opts.claim ?? true
    },
    releaseSend: async () => {
      calls.releases++
    },
  }
  return { db, calls }
}

const user = { id: 'user-1', email: 'dona@example.com', name: 'Maria' }

async function rejects(p: Promise<unknown>, status: number, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof HttpError && e.status === status && e.code === code)
}

describe('convite por e-mail', () => {
  it('valida o id do convite', () => {
    assert.equal(parseInviteEmailInput({ inviteId: ID }).inviteId, ID)
    assert.throws(() => parseInviteEmailInput({ inviteId: 'x' }), HttpError)
    assert.throws(() => parseInviteEmailInput(null), HttpError)
  })

  it('envia para o e-mail do convite, com link, resposta para a dona e chave de idempotência', async () => {
    const sent: OutgoingEmail[] = []
    const { db, calls } = fakeDb()
    const res = await sendInviteEmail({ db, send: async (e) => void sent.push(e), appUrl: 'https://app.ikizy.com', now: NOW }, user, { inviteId: ID })
    assert.equal(res.sentTo, 'bia@example.com')
    assert.equal(calls.claims, 1)
    assert.equal(sent[0].to, 'bia@example.com')
    assert.equal(sent[0].replyTo, 'dona@example.com')
    assert.equal(sent[0].idempotencyKey, `invite-${ID}-1`)
    assert.ok(sent[0].html.includes(`https://app.ikizy.com/convite/${'a'.repeat(64)}`))
    assert.ok(sent[0].text.includes('como profissional'))
    assert.equal(sent[0].subject, 'Maria convidou você para a equipe de Studio <Ana>')
  })

  it('escapa o que o salão digitou no HTML', () => {
    const { html } = renderInviteEmail({ salonName: '<script>x</script>', inviterName: null, name: 'Bia', role: 'reception', url: 'https://app.ikizy.com/convite/t', expiresAt: NOW })
    assert.ok(!html.includes('<script>x'))
    assert.ok(html.includes('&lt;script&gt;'))
  })

  it('só a dona do mesmo salão envia', async () => {
    const send = async () => {}
    await rejects(sendInviteEmail({ db: fakeDb({ member: { salonId: 'salon-1', role: 'manager' } }).db, send, appUrl: '', now: NOW }, user, { inviteId: ID }), 403, 'not_owner')
    await rejects(sendInviteEmail({ db: fakeDb({ member: null }).db, send, appUrl: '', now: NOW }, user, { inviteId: ID }), 404, 'no_salon')
    await rejects(sendInviteEmail({ db: fakeDb({ invite: invite({ salonId: 'outro' }) }).db, send, appUrl: '', now: NOW }, user, { inviteId: ID }), 404, 'invite_not_found')
    await rejects(sendInviteEmail({ db: fakeDb({ invite: null }).db, send, appUrl: '', now: NOW }, user, { inviteId: ID }), 404, 'invite_not_found')
  })

  it('bloqueia sem e-mail, aceito, vencido, muitos envios e reenvio em menos de 1 minuto', () => {
    assert.equal(blockReason(invite(), NOW), null)
    assert.equal(blockReason(invite({ email: null }), NOW)?.code, 'no_email')
    assert.equal(blockReason(invite({ acceptedAt: NOW }), NOW)?.code, 'invite_used')
    assert.equal(blockReason(invite({ expiresAt: NOW }), NOW)?.code, 'invite_expired')
    assert.equal(blockReason(invite({ emailCount: MAX_SENDS }), NOW)?.code, 'too_many_sends')
    assert.equal(blockReason(invite({ emailSentAt: new Date(NOW.getTime() - 30_000), emailCount: 1 }), NOW)?.code, 'too_soon')
    assert.equal(blockReason(invite({ emailSentAt: new Date(NOW.getTime() - 61_000), emailCount: 1 }), NOW), null)
  })

  it('envio concorrente que perdeu a vez não manda e-mail', async () => {
    let sent = 0
    await rejects(sendInviteEmail({ db: fakeDb({ claim: false }).db, send: async () => void sent++, appUrl: '', now: NOW }, user, { inviteId: ID }), 429, 'too_soon')
    assert.equal(sent, 0)
  })

  it('se o Resend falhar, devolve a vaga para tentar de novo', async () => {
    const { db, calls } = fakeDb()
    const send = async () => {
      throw new HttpError(502, 'email_failed', 'falhou')
    }
    await rejects(sendInviteEmail({ db, send, appUrl: '', now: NOW }, user, { inviteId: ID }), 502, 'email_failed')
    assert.equal(calls.releases, 1)
  })

  it('resendSender chama a API com a chave, o remetente e a idempotência', async () => {
    const reqs: { url: string; init: RequestInit }[] = []
    const fakeFetch = (async (url: string, init: RequestInit) => {
      reqs.push({ url, init })
      return new Response('{"id":"x"}', { status: 200 })
    }) as unknown as typeof fetch
    await resendSender('re_test', 'IKIZY <convites@ikizy.com>', fakeFetch)({ to: 'a@b.com', subject: 's', html: 'h', text: 't', replyTo: 'd@b.com', idempotencyKey: 'k1' })
    assert.equal(reqs[0].url, 'https://api.resend.com/emails')
    const headers = reqs[0].init.headers as Record<string, string>
    assert.equal(headers.authorization, 'Bearer re_test')
    assert.equal(headers['idempotency-key'], 'k1')
    const body = JSON.parse(reqs[0].init.body as string)
    assert.deepEqual(body.to, ['a@b.com'])
    assert.equal(body.from, 'IKIZY <convites@ikizy.com>')
    assert.equal(body.reply_to, 'd@b.com')

    const failing = (async () => new Response('bad', { status: 422 })) as unknown as typeof fetch
    const orig = console.error
    console.error = () => {}
    await rejects(resendSender('re_test', 'x', failing)({ to: 'a@b.com', subject: 's', html: 'h', text: 't', idempotencyKey: 'k' }), 502, 'email_failed')
    console.error = orig
  })
})

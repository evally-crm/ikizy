import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, it } from 'node:test'
import { parseOtpEvent, renderOtpEmail, verifyNeonWebhook } from './authEmail.js'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' }

/** assina como o Neon Auth: JWS destacado sobre `timestamp.base64url(corpo)` */
function signed(body: string, timestamp: number, kid = 'k1') {
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWS', kid })).toString('base64url')
  const payload = Buffer.from(`${timestamp}.${Buffer.from(body).toString('base64url')}`).toString('base64url')
  const sig = sign(null, Buffer.from(`${header}.${payload}`), privateKey).toString('base64url')
  return new Headers({ 'x-neon-signature': `${header}..${sig}`, 'x-neon-signature-kid': kid, 'x-neon-timestamp': String(timestamp) })
}

const NOW = 1_800_000_000_000
const BODY = JSON.stringify({ event_type: 'send.otp', user: { email: 'ana@exemplo.com' }, event_data: { otp_code: '379311', otp_type: 'email-verification' } })

describe('verifyNeonWebhook', () => {
  it('aceita assinatura válida', () => {
    const out = verifyNeonWebhook(BODY, signed(BODY, NOW), { keys: [jwk] }, NOW + 1000)
    assert.equal((out as { event_type: string }).event_type, 'send.otp')
  })

  it('recusa corpo alterado, chave desconhecida, cabeçalhos ausentes e timestamp velho', () => {
    assert.throws(() => verifyNeonWebhook(BODY + ' ', signed(BODY, NOW), { keys: [jwk] }, NOW))
    assert.throws(() => verifyNeonWebhook(BODY, signed(BODY, NOW, 'outra'), { keys: [jwk] }, NOW), /unknown_key/)
    assert.throws(() => verifyNeonWebhook(BODY, new Headers(), { keys: [jwk] }, NOW), /missing_headers/)
    assert.throws(() => verifyNeonWebhook(BODY, signed(BODY, NOW), { keys: [jwk] }, NOW + 10 * 60 * 1000), /stale_timestamp/)
  })
})

describe('parseOtpEvent', () => {
  it('lê o código e o e-mail do send.otp', () => {
    assert.deepEqual(parseOtpEvent(JSON.parse(BODY)), { eventType: 'send.otp', code: '379311', otpType: 'email-verification', email: 'ana@exemplo.com' })
  })

  it('ignora outros eventos, código estranho e SMS', () => {
    assert.equal(parseOtpEvent({ event_type: 'user.created' }), null)
    assert.equal(parseOtpEvent({ event_type: 'send.otp', user: { email: 'a@b.c' }, event_data: { otp_code: '<script>' } }), null)
    assert.equal(
      parseOtpEvent({ event_type: 'send.otp', user: { email: 'a@b.c' }, event_data: { otp_code: '123456', delivery_preference: 'sms' } }),
      null,
    )
  })
})

describe('renderOtpEmail', () => {
  it('traz o código, o assunto em português e escapa o e-mail', () => {
    const { subject, html, text } = renderOtpEmail('379311', '"><b>x@y.com', 'email-verification')
    assert.match(subject, /379311/)
    assert.match(html, />379311</)
    assert.ok(!html.includes('"><b>x@y.com'))
    assert.match(text, /379311/)
  })
})

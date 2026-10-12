import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HttpError } from './billing.js'
import { assertCronAuthorized, runExpireRequests } from './cron.js'

const status = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    return e instanceof HttpError ? e.status : 'outro'
  }
  return 'ok'
}

describe('cron', () => {
  it('só roda com o segredo certo no cabeçalho', () => {
    assert.equal(status(() => assertCronAuthorized('Bearer abc123', 'abc123')), 'ok')
    assert.equal(status(() => assertCronAuthorized('Bearer errado!', 'abc123')), 401)
    assert.equal(status(() => assertCronAuthorized(null, 'abc123')), 401)
    assert.equal(status(() => assertCronAuthorized('abc123', 'abc123')), 401)
  })

  it('sem segredo configurado, recusa tudo (nunca fica aberto)', () => {
    assert.equal(status(() => assertCronAuthorized('Bearer ', '')), 503)
    assert.equal(status(() => assertCronAuthorized('Bearer undefined', undefined)), 503)
  })

  it('devolve quantos pedidos venceram', async () => {
    assert.deepEqual(await runExpireRequests({ expireStaleRequests: async () => 3 }), { expired: 3 })
  })
})

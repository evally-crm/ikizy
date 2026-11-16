import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HttpError } from './billing.js'
import { LIMITS, throttle, type Limiter } from './throttle.js'

const counting = () => {
  const hits: Record<string, number> = {}
  const calls: [string, number, number][] = []
  const db: Limiter = {
    async limited(bucket, max, windowSeconds) {
      calls.push([bucket, max, windowSeconds])
      hits[bucket] = (hits[bucket] ?? 0) + 1
      return hits[bucket] > max
    },
  }
  return { db, calls }
}

describe('limite por pessoa', () => {
  it('deixa passar até o máximo e recusa a tentativa seguinte com 429', async () => {
    const { db } = counting()
    for (let i = 0; i < LIMITS['account:delete'].max; i++) await throttle(db, 'u1', 'account:delete')
    await assert.rejects(throttle(db, 'u1', 'account:delete'), (e) => e instanceof HttpError && e.status === 429 && e.code === 'too_many')
  })

  it('cada pessoa e cada rota têm o próprio contador', async () => {
    const { db, calls } = counting()
    for (let i = 0; i < LIMITS['account:delete'].max; i++) await throttle(db, 'u1', 'account:delete')
    await throttle(db, 'u2', 'account:delete')
    await throttle(db, 'u1', 'billing')
    assert.deepEqual(calls.at(-1), ['user:billing:u1', LIMITS.billing.max, LIMITS.billing.window])
  })

  it('se o limitador falhar, a rota segue funcionando', async () => {
    const db: Limiter = {
      async limited() {
        throw new Error('banco fora do ar')
      },
    }
    await throttle(db, 'u1', 'account:me')
  })

  it('o balde cabe no limite de 160 caracteres do banco', () => {
    for (const key of Object.keys(LIMITS)) assert.ok(`user:${key}:${'0'.repeat(36)}`.length <= 160)
  })
})

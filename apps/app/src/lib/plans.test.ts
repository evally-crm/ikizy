import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { accessState, describeSubscription, type SubscriptionInfo } from './plans'

const base: SubscriptionInfo = {
  plan: 'salao',
  status: 'trialing',
  trialEndsAt: null,
  accessUntil: new Date('2026-01-01T00:00:00Z'),
  method: null,
  cancelAtPeriodEnd: false,
  hasCustomer: false,
  planChosen: true,
  complimentary: false,
}

describe('cortesia', () => {
  const now = new Date('2026-11-17T12:00:00Z')
  it('sem cortesia, data vencida = expired', () => {
    assert.equal(accessState(base, now), 'expired')
  })
  it('com cortesia, sempre ativo e sem vencimento', () => {
    const sub = { ...base, complimentary: true }
    assert.equal(accessState(sub, now), 'active')
    assert.equal(describeSubscription(sub, now), 'Salão · cortesia, sem vencimento')
  })
})

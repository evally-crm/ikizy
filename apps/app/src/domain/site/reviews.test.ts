import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { firstNameOf, newestFirst, summarizeReviews, type ReviewItem } from './reviews'

const r = (over: Partial<ReviewItem>): ReviewItem => ({
  id: 'x',
  rating: 5,
  comment: '',
  hidden: false,
  createdAt: '2026-11-01T10:00:00Z',
  service: 'Manicure',
  firstName: 'Ana',
  ...over,
})

describe('avaliações', () => {
  it('primeiro nome da ficha; vazio se a cliente foi removida', () => {
    assert.equal(firstNameOf('  Ana Paula Souza '), 'Ana')
    assert.equal(firstNameOf('Cliente removida'), '')
    assert.equal(firstNameOf(null), '')
  })

  it('média e contagem só das que aparecem no site', () => {
    const s = summarizeReviews([r({ rating: 5 }), r({ rating: 4 }), r({ rating: 1, hidden: true })])
    assert.deepEqual(s, { count: 2, average: 4.5, hidden: 1 })
  })

  it('sem avaliações visíveis não há média', () => {
    assert.deepEqual(summarizeReviews([]), { count: 0, average: null, hidden: 0 })
    assert.equal(summarizeReviews([r({ hidden: true })]).average, null)
  })

  it('a mais nova vem primeiro e a lista original não muda', () => {
    const list = [r({ id: 'a', createdAt: '2026-11-01T10:00:00Z' }), r({ id: 'b', createdAt: '2026-11-05T10:00:00Z' })]
    assert.deepEqual(newestFirst(list).map((x) => x.id), ['b', 'a'])
    assert.equal(list[0].id, 'a')
  })
})

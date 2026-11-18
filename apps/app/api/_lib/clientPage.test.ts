import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RATING_LABEL, TOKEN, bookingLink, renderBookingStatus, type BookingStatus } from './clientPage.js'
import { parseReviewInput, isReviewRequest, translateDbError } from './booking.js'
import { HttpError } from './billing.js'

const T = 'a'.repeat(64)
const status = (over: Partial<BookingStatus> = {}): BookingStatus => ({
  salon: { name: 'Studio Maria', slug: 'studio-maria', whatsapp: '(11) 98765-0000' },
  client: 'Ana',
  status: 'pendente',
  items: [
    { service: 'Manicure', starts_at: '2026-11-20T12:00:00Z', duration: 60, professional: 'Bia', status: 'pendente' },
    { service: 'Pedicure', starts_at: '2026-11-20T13:00:00Z', duration: 45, professional: 'Bia', status: 'pendente' },
  ],
  review: null,
  ...over,
})
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{231A}-\u{23FF}]/u

describe('página da cliente', () => {
  it('pedido pendente: status, serviços em ordem, hora de Brasília e sem formulário de avaliação', () => {
    const html = renderBookingStatus(status(), null, T)
    assert.match(html, /Aguardando confirmação/)
    assert.match(html, /Olá, Ana/)
    assert.ok(html.indexOf('Manicure') < html.indexOf('Pedicure'))
    assert.match(html, />09:00</)
    assert.match(html, /com Bia/)
    assert.doesNotMatch(html, /id="rv"/)
    assert.match(html, /noindex/)
    assert.match(html, /no-referrer/)
    assert.doesNotMatch(html, EMOJI)
  })

  it('concluído sem avaliação: notas de 1 a 5 com nome e o script; já avaliado mostra a avaliação', () => {
    const html = renderBookingStatus(status({ status: 'concluido' }), null, T)
    assert.match(html, /Atendimento concluído/)
    assert.match(html, /<form id="rv" data-token="a{64}"/)
    for (let n = 1; n <= 5; n++) assert.match(html, new RegExp(`data-r="${n}"[^>]*aria-label="${n}, ${RATING_LABEL[n - 1]}"`))
    assert.match(html, /<script>/)
    const done = renderBookingStatus(status({ status: 'concluido', review: { rating: 4, comment: 'Amei!', created_at: '' } }), null, T)
    assert.doesNotMatch(done, /id="rv"/)
    assert.match(done, /Nota 4 de 5/)
    assert.match(done, /Amei!/)
    assert.doesNotMatch(done, /<script>/)
  })

  it('nada do que a cliente ou o salão digitou vira HTML', () => {
    const evil = '<img src=x onerror=alert(1)>'
    const html = renderBookingStatus(
      status({ status: 'concluido', client: evil, salon: { name: evil, slug: 'studio-maria', whatsapp: '' }, review: { rating: 5, comment: evil, created_at: '' } }),
      null,
      T,
    )
    assert.doesNotMatch(html, /<img src=x/)
  })

  it('link no domínio do salão e só tokens de 64 letras', () => {
    assert.equal(bookingLink('studio-maria', T), `https://studio-maria.ikizy.com/pedido/${T}`)
    assert.ok(TOKEN.test(T))
    assert.ok(!TOKEN.test('abc'))
  })
})

describe('avaliação (POST /api/booking)', () => {
  const code = (fn: () => unknown) => {
    try {
      fn()
      return 'ok'
    } catch (e) {
      return e instanceof HttpError ? e.status : 'outro'
    }
  }
  it('reconhece o pedido de avaliação e limpa o texto', () => {
    assert.ok(isReviewRequest({ action: 'review' }))
    assert.ok(!isReviewRequest({ slug: 'x' }))
    assert.deepEqual(parseReviewInput({ token: T.toUpperCase(), rating: 5, comment: '  muito   bom \n ' }), { token: T, rating: 5, comment: 'muito bom' })
  })
  it('recusa token ruim, nota fora de 1 a 5 e texto longo', () => {
    assert.equal(code(() => parseReviewInput({ token: 'x', rating: 5 })), 404)
    assert.equal(code(() => parseReviewInput({ token: T, rating: 0 })), 400)
    assert.equal(code(() => parseReviewInput({ token: T, rating: 4.5 })), 400)
    assert.equal(code(() => parseReviewInput({ token: T, rating: 3, comment: 'a'.repeat(501) })), 400)
  })
  it('traduz os erros do banco', () => {
    assert.equal(translateDbError(new Error('already_reviewed')).status, 409)
    assert.equal(translateDbError(new Error('not_done')).status, 409)
    assert.equal(translateDbError(new Error('not_found')).status, 404)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RATING_LABEL, TOKEN, bookingLink, renderBookingStatus, type BookingStatus } from './clientPage.js'
import { CHANGE_NOTICE_HOURS, isChangeRequest, isReviewRequest, parseChangeInput, parseRescheduleQuery, parseReviewInput, translateDbError } from './booking.js'
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

describe('remarcar e cancelar pelo link', () => {
  const code = (fn: () => unknown) => {
    try {
      fn()
      return 'ok'
    } catch (e) {
      return e instanceof HttpError ? e.status : 'outro'
    }
  }

  it('pedido em aberto que ainda dá tempo: botões Remarcar e Cancelar, dias e script', () => {
    const html = renderBookingStatus(status({ can_change: true, window_days: 30 }), null, T)
    assert.match(html, /id="chg-open-re"[^>]*>Remarcar</)
    assert.match(html, /id="chg-open-ca"[^>]*>Cancelar</)
    assert.match(html, /data-token="a{64}"/)
    assert.match(html, /data-span="14"/)
    assert.match(html, /data-today="\d{4}-\d{2}-\d{2}"/)
    assert.match(html, /O salão confirma de novo/)
    assert.match(html, /<script>/)
    assert.doesNotMatch(html, EMOJI)
  })

  it('o painel de remarcar e o de cancelar começam fechados', () => {
    const html = renderBookingStatus(status({ can_change: true }), null, T)
    assert.match(html, /id="chg-re" hidden/)
    assert.match(html, /id="chg-ca" hidden/)
  })

  it('faltando pouco tempo: sem botões, manda falar com o salão', () => {
    const html = renderBookingStatus(status({ can_change: false }), null, T)
    assert.doesNotMatch(html, /id="chg"/)
    assert.match(html, new RegExp(`menos de ${CHANGE_NOTICE_HOURS} horas`))
    assert.match(html, /WhatsApp/)
    assert.doesNotMatch(html, /chg-open-re/)
  })

  it('concluído e cancelado não oferecem mudança', () => {
    for (const st of ['concluido', 'cancelado', 'faltou'] as const) {
      const html = renderBookingStatus(status({ status: st, can_change: true }), null, T)
      assert.doesNotMatch(html, /id="chg"/)
      assert.doesNotMatch(html, /Precisa mudar/)
    }
  })

  it('o prazo do servidor e o do banco são o mesmo número', () => {
    assert.equal(CHANGE_NOTICE_HOURS, 2)
  })

  it('lê o pedido de horários livres e recusa token ou dia ruins', () => {
    assert.deepEqual(parseRescheduleQuery(new URL(`https://x/api/booking?pedido=${T.toUpperCase()}&date=2026-11-25`)), { token: T, date: '2026-11-25' })
    assert.equal(code(() => parseRescheduleQuery(new URL('https://x/api/booking?pedido=abc&date=2026-11-25'))), 404)
    assert.equal(code(() => parseRescheduleQuery(new URL(`https://x/api/booking?pedido=${T}&date=2026-13-45`))), 400)
  })

  it('lê cancelar e remarcar, e reconhece o tipo do pedido', () => {
    assert.ok(isChangeRequest({ action: 'cancel' }))
    assert.ok(isChangeRequest({ action: 'reschedule' }))
    assert.ok(!isChangeRequest({ action: 'review' }))
    assert.ok(!isChangeRequest(null))
    assert.deepEqual(parseChangeInput({ action: 'cancel', token: T }), { action: 'cancel', token: T })
    assert.deepEqual(parseChangeInput({ action: 'reschedule', token: T, date: '2026-11-25', minute: 600 }), { action: 'reschedule', token: T, date: '2026-11-25', minute: 600 })
  })

  it('remarcar sem dia ou horário válido é recusado', () => {
    assert.equal(code(() => parseChangeInput({ action: 'reschedule', token: T, date: 'ontem', minute: 600 })), 400)
    assert.equal(code(() => parseChangeInput({ action: 'reschedule', token: T, date: '2026-11-25', minute: 1500 })), 400)
    assert.equal(code(() => parseChangeInput({ action: 'reschedule', token: T, date: '2026-11-25', minute: 10.5 })), 400)
    assert.equal(code(() => parseChangeInput({ action: 'cancel', token: 'x' })), 404)
  })

  it('traduz o prazo vencido', () => {
    assert.equal(translateDbError(new Error('not_allowed')).status, 409)
    assert.equal(translateDbError(new Error('slot_unavailable')).status, 409)
  })
})

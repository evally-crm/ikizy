import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HttpError } from './billing.js'
import { checkBookingLimits, createBooking, listSlots, shortHash, parseBookingInput, parseSlotsQuery, tooManyFromIp, translateDbError, type BookingDb } from './booking.js'

const SVC = '11111111-1111-4111-8111-111111111111'
const PRO = '22222222-2222-4222-8222-222222222222'

const body = (over: Record<string, unknown> = {}) => ({
  slug: 'studio-maria',
  service: SVC,
  date: '2026-10-19',
  minute: 600,
  name: '  Maria   Silva ',
  phone: '(11) 98765-0000',
  ...over,
})

const status = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e instanceof HttpError ? e.status : 'outro'
  }
  return 'ok'
}

describe('parseSlotsQuery', () => {
  it('aceita consulta válida e normaliza o slug', () => {
    const q = parseSlotsQuery(new URL(`https://x.test/api/booking?slug=Studio-Maria&service=${SVC}&date=2026-10-19`))
    assert.deepEqual(q, { slug: 'studio-maria', service: SVC, date: '2026-10-19', professional: null })
  })

  it('recusa slug, serviço, data e profissional inválidos', () => {
    const url = (qs: string) => new URL(`https://x.test/api/booking?${qs}`)
    assert.equal(status(() => parseSlotsQuery(url(`slug=a&service=${SVC}&date=2026-10-19`))), 400)
    assert.equal(status(() => parseSlotsQuery(url(`slug=studio&service=1;drop&date=2026-10-19`))), 400)
    assert.equal(status(() => parseSlotsQuery(url(`slug=studio&service=${SVC}&date=2026-02-31`))), 400)
    assert.equal(status(() => parseSlotsQuery(url(`slug=studio&service=${SVC}&date=19/10/2026`))), 400)
    assert.equal(status(() => parseSlotsQuery(url(`slug=studio&service=${SVC}&date=2026-10-19&professional=x`))), 400)
  })

  it('aceita profissional escolhida', () => {
    const q = parseSlotsQuery(new URL(`https://x.test/?slug=studio&service=${SVC}&date=2026-10-19&professional=${PRO}`))
    assert.equal(q.professional, PRO)
  })
})

describe('parseBookingInput', () => {
  it('limpa nome e deixa só os dígitos do telefone', () => {
    const r = parseBookingInput(body())
    assert.equal(r.name, 'Maria Silva')
    assert.equal(r.phone, '11987650000')
    assert.equal(r.minute, 600)
    assert.equal(r.honeypot, false)
  })

  it('recusa corpo vazio, horário fora do dia, nome curto e telefone curto', () => {
    assert.equal(status(() => parseBookingInput(null)), 400)
    assert.equal(status(() => parseBookingInput(body({ minute: 1440 }))), 400)
    assert.equal(status(() => parseBookingInput(body({ minute: 10.5 }))), 400)
    assert.equal(status(() => parseBookingInput(body({ minute: '600' }))), 400)
    assert.equal(status(() => parseBookingInput(body({ name: 'A' }))), 400)
    assert.equal(status(() => parseBookingInput(body({ phone: '123' }))), 400)
  })

  it('marca como robô quando o campo escondido vem preenchido', () => {
    assert.equal(parseBookingInput(body({ company: 'spam ltda' })).honeypot, true)
  })
})

describe('erros do banco', () => {
  it('viram respostas amigáveis com o status certo', () => {
    assert.equal(translateDbError(new Error('slot_unavailable')).status, 409)
    assert.equal(translateDbError(new Error('booking_disabled')).status, 403)
    assert.equal(translateDbError(new Error('too_many')).status, 429)
    assert.equal(translateDbError(new Error('invalid_input')).status, 400)
  })

  it('erro desconhecido não é escondido nem vira mensagem ao público', () => {
    assert.throws(() => translateDbError(new Error('connection reset')), /connection reset/)
  })

  it('createBooking e listSlots repassam o resultado e traduzem falhas', async () => {
    const ok: BookingDb = {
      slots: async () => [{ professional_id: PRO, professional: 'Ana', minute: 600 }],
      book: async () => ({ id: 'x', starts_at: '2026-10-19T13:00:00Z', service: 'Gel', professional: 'Ana', price: 100, duration: 60 }),
      limited: async () => false,
    }
    const input = parseBookingInput(body())
    assert.equal((await listSlots(ok, input)).length, 1)
    assert.equal((await createBooking(ok, input)).service, 'Gel')

    const busy: BookingDb = { ...ok, book: async () => Promise.reject(new Error('slot_unavailable')) }
    await assert.rejects(createBooking(busy, input), (e) => e instanceof HttpError && e.status === 409)
  })
})

describe('tooManyFromIp', () => {
  it('bloqueia depois do limite e libera quando a janela passa', () => {
    const ip = 'teste-1'
    const t0 = 1_000_000
    for (let i = 0; i < 12; i++) assert.equal(tooManyFromIp(ip, t0 + i), false)
    assert.equal(tooManyFromIp(ip, t0 + 13), true)
    assert.equal(tooManyFromIp(ip, t0 + 11 * 60_000), false)
  })
})

describe('limites do pedido (no banco)', () => {
  const dbWith = (limited: BookingDb['limited']): BookingDb => ({
    slots: async () => [],
    book: async () => Promise.reject(new Error('não deveria reservar')),
    limited,
  })

  it('deixa passar quando nenhum limite foi atingido e guarda só o resumo do IP e do telefone', async () => {
    const buckets: string[] = []
    await checkBookingLimits(dbWith(async (b) => (buckets.push(b), false)), '203.0.113.9', '11987650000')
    assert.equal(buckets.length, 2)
    assert.ok(buckets.every((b) => /^booking:(ip|phone):[0-9a-f]{24}$/.test(b)))
    assert.ok(!buckets.join().includes('203.0.113.9') && !buckets.join().includes('11987650000'))
  })

  it('bloqueia com 429 quando o IP ou o WhatsApp passou do limite', async () => {
    const byIp = dbWith(async (b) => b.startsWith('booking:ip:'))
    const byPhone = dbWith(async (b) => b.startsWith('booking:phone:'))
    for (const db of [byIp, byPhone]) {
      await assert.rejects(checkBookingLimits(db, '203.0.113.9', '11987650000'), (e) => e instanceof HttpError && e.status === 429)
    }
  })

  it('segue sem o limitador se ele falhar (a trava do salão continua no banco)', async () => {
    const quiet = console.error
    console.error = () => {}
    try {
      await checkBookingLimits(dbWith(async () => Promise.reject(new Error('function hit_rate_limit does not exist'))), '203.0.113.9', '11987650000')
    } finally {
      console.error = quiet
    }
  })

  it('o resumo é estável e diferente para entradas diferentes', async () => {
    assert.equal(await shortHash('a'), await shortHash('a'))
    assert.notEqual(await shortHash('a'), await shortHash('b'))
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildMonth, buildPeriod } from './month'
import { appt, expense, pro } from './fixtures.test-helpers'

const OCT = new Date(2026, 9, 1)
const TODAY = new Date(2026, 9, 12, 15, 0)

const base = { date: OCT, today: TODAY, current: true, clientsCreated: {}, productsSpend: 0, expenses: [], professionals: [] }

describe('buildMonth', () => {
  it('soma só atendimentos concluídos do mês e conta as faltas à parte', () => {
    const m = buildMonth({
      ...base,
      appointments: [
        appt({ id: '1', price: 100 }),
        appt({ id: '2', price: 50, startsAt: new Date(2026, 9, 3, 9, 0) }),
        appt({ id: '3', price: 80, status: 'faltou' }),
        appt({ id: '4', price: 999, startsAt: new Date(2026, 8, 30, 9, 0) }), // mês anterior
      ],
    })
    assert.equal(m.gross, 150)
    assert.equal(m.appointments, 2)
    assert.equal(m.noShows, 1)
    assert.equal(m.ticket, 75)
  })

  it('agrupa por categoria e forma de pagamento, do maior para o menor', () => {
    const m = buildMonth({
      ...base,
      appointments: [
        appt({ id: '1', category: 'Unhas', price: 100, paymentMethod: 'pix' }),
        appt({ id: '2', category: 'Cílios', price: 300, paymentMethod: 'credito' }),
        appt({ id: '3', category: '', price: 20, paymentMethod: null }),
      ],
    })
    assert.deepEqual(m.categories.map((c) => c.name), ['Cílios', 'Unhas', 'Outros'])
    assert.deepEqual(m.payments.map((p) => p.method), ['Crédito', 'Pix', 'Não informado'])
  })

  it('cobra taxa de cartão só sobre crédito e débito (3,1%)', () => {
    const m = buildMonth({
      ...base,
      appointments: [
        appt({ id: '1', price: 1000, paymentMethod: 'credito' }),
        appt({ id: '2', price: 500, paymentMethod: 'debito' }),
        appt({ id: '3', price: 700, paymentMethod: 'pix' }),
      ],
    })
    assert.equal(m.cardFees, 46.5)
  })

  it('comissão só para quem tem percentual e atendimentos', () => {
    const m = buildMonth({
      ...base,
      professionals: [pro('p1', 40), pro('p2', 0), pro('p3', 30)],
      appointments: [appt({ id: '1', professionalId: 'p1', price: 200 }), appt({ id: '2', professionalId: 'p2', price: 100 })],
    })
    assert.deepEqual(m.commissions, [{ professionalId: 'p1', qty: 1, total: 80 }])
    assert.equal(m.commissionsTotal, 80)
  })

  it('lucro líquido = faturamento − taxas − produtos − saídas − comissões', () => {
    const m = buildMonth({
      ...base,
      productsSpend: 100,
      professionals: [pro('p1', 10)],
      expenses: [expense('e1', '2026-10-05', 40), expense('e2', '2026-09-30', 999)],
      appointments: [appt({ id: '1', price: 1000, paymentMethod: 'credito' })],
    })
    // 1000 − 31 (taxa) − 100 (produtos) − 40 (saída do mês) − 100 (comissão)
    assert.equal(m.net, 729)
    assert.equal(m.expenses, 40)
  })

  it('o mês em andamento marca os dias que ainda não chegaram como nulos', () => {
    const m = buildMonth({ ...base, appointments: [appt({ id: '1', price: 70, startsAt: new Date(2026, 9, 12, 8, 0) })] })
    assert.equal(m.daysInMonth, 31)
    assert.equal(m.elapsedDays, 12)
    assert.equal(m.daily[11], 70)
    assert.equal(m.daily[12], null)
  })

  it('novas clientes e retorno vêm da data de cadastro', () => {
    const m = buildMonth({
      ...base,
      clientsCreated: { a: new Date(2026, 8, 1), b: new Date(2026, 9, 5) },
      appointments: [appt({ id: '1', clientId: 'a' }), appt({ id: '2', clientId: 'b' })],
    })
    assert.equal(m.newClients, 1)
    assert.equal(m.returnRate, 50)
  })
})

describe('buildPeriod', () => {
  const period = { today: TODAY, clientsCreated: {}, expenses: [], professionals: [] }

  it('soma só os dias do período, inclusive o último, e não cobra produtos', () => {
    const p = buildPeriod({
      ...period,
      from: new Date(2026, 9, 3),
      to: new Date(2026, 9, 5),
      appointments: [
        appt({ id: '1', price: 10, startsAt: new Date(2026, 9, 2, 23, 0) }),
        appt({ id: '2', price: 20, startsAt: new Date(2026, 9, 3, 8, 0) }),
        appt({ id: '3', price: 30, startsAt: new Date(2026, 9, 5, 20, 0) }),
        appt({ id: '4', price: 40, startsAt: new Date(2026, 9, 6, 8, 0) }),
      ],
    })
    assert.equal(p.gross, 50)
    assert.equal(p.products, 0)
    assert.equal(p.partial, true)
    assert.equal(p.daysInMonth, 3)
    assert.deepEqual(p.daily, [20, 0, 30])
  })

  it('atravessa meses e só soma as saídas lançadas dentro das datas', () => {
    const p = buildPeriod({
      ...period,
      from: new Date(2026, 8, 28),
      to: new Date(2026, 9, 2),
      expenses: [expense('a', '2026-09-27', 5), expense('b', '2026-09-30', 7), expense('c', '2026-10-02', 11), expense('d', '2026-10-03', 13)],
      appointments: [appt({ id: '1', price: 100, startsAt: new Date(2026, 9, 1, 9, 0) })],
    })
    assert.equal(p.expenses, 18)
    assert.equal(p.daily.length, 5)
    assert.equal(p.daily[3], 100)
    assert.equal(p.net, 82)
  })

  it('um dia só vira um período de um dia e os dias futuros ficam nulos', () => {
    const p = buildPeriod({ ...period, from: new Date(2026, 9, 12), to: new Date(2026, 9, 14), appointments: [] })
    assert.deepEqual(p.daily, [0, null, null])
  })
})

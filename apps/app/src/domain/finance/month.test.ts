import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildMonth } from './month'
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

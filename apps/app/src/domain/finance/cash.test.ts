import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildDayCash } from './cash'
import { buildDayStatement } from './day'
import { appt, expense, pro } from './fixtures.test-helpers'
import type { CashAppointment } from './types'

const a = (over: Partial<CashAppointment> & { id: string }): CashAppointment & { id: string } => ({
  date: '2026-10-12',
  start: 600,
  status: 'concluido',
  price: 100,
  paymentMethod: 'pix',
  ...over,
})

describe('buildDayCash', () => {
  it('separa o que já entrou do que falta receber e ordena por horário', () => {
    const cash = buildDayCash(
      '2026-10-12',
      [
        a({ id: '1', start: 900, price: 100 }),
        a({ id: '2', start: 600, price: 50 }),
        a({ id: '3', status: 'confirmado', price: 200 }),
        a({ id: '4', status: 'cancelado', price: 999 }),
        a({ id: '5', date: '2026-10-13', price: 999 }),
      ],
      [],
    )
    assert.deepEqual(cash.received.map((x) => x.id), ['2', '1'])
    assert.equal(cash.total, 150)
    assert.equal(cash.expected, 200)
  })

  it('totaliza por forma de pagamento na ordem do caixa, com "não informado" no fim', () => {
    const cash = buildDayCash(
      '2026-10-12',
      [
        a({ id: '1', paymentMethod: 'dinheiro', price: 30 }),
        a({ id: '2', paymentMethod: 'pix', price: 70 }),
        a({ id: '3', paymentMethod: null, price: 10 }),
      ],
      [],
    )
    assert.deepEqual(cash.byMethod.map((m) => [m.label, m.total]), [['Pix', 70], ['Dinheiro', 30], ['Não informado', 10]])
  })

  it('soma só as saídas do dia', () => {
    const cash = buildDayCash('2026-10-12', [], [expense('e1', '2026-10-12', 25), expense('e2', '2026-10-11', 90)])
    assert.equal(cash.expensesTotal, 25)
    assert.equal(cash.expenses.length, 1)
  })
})

describe('buildDayStatement', () => {
  it('fecha o resultado do dia: recebido − taxas − comissões − saídas', () => {
    const day = buildDayStatement({
      date: '2026-10-12',
      professionals: [pro('p1', 50)],
      expenses: [expense('e1', '2026-10-12', 20)],
      appointments: [
        appt({ id: '1', price: 200, paymentMethod: 'credito', startsAt: new Date(2026, 9, 12, 14, 0) }),
        appt({ id: '2', price: 100, paymentMethod: 'pix', startsAt: new Date(2026, 9, 12, 9, 30) }),
        appt({ id: '3', price: 80, status: 'faltou' }),
        appt({ id: '4', price: 500, startsAt: new Date(2026, 9, 11, 9, 0) }),
      ],
    })
    assert.equal(day.gross, 300)
    assert.equal(day.cardFees, 6.2)
    assert.equal(day.commissionsTotal, 150)
    assert.equal(day.expensesTotal, 20)
    assert.equal(day.net, 123.8)
    assert.equal(day.count, 2)
    assert.equal(day.noShows, 1)
    assert.deepEqual(day.items.map((i) => i.time), [9 * 60 + 30, 14 * 60])
  })

  it('dia sem atendimentos devolve tudo zerado, sem erro', () => {
    const day = buildDayStatement({ date: '2026-10-12', professionals: [], expenses: [], appointments: [] })
    assert.equal(day.gross, 0)
    assert.equal(day.net, 0)
    assert.deepEqual(day.items, [])
  })
})

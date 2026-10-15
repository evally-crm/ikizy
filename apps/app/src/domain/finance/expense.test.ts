import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkExpense, defaultExpenseDate, parseAmount } from './expense'

describe('saída (despesa)', () => {
  it('lê o valor no jeito brasileiro', () => {
    assert.equal(parseAmount('1.250,50'), 1250.5)
    assert.equal(parseAmount('80'), 80)
    assert.ok(Number.isNaN(parseAmount('abc')))
  })

  it('aceita uma saída válida e limpa a descrição', () => {
    const r = checkExpense({ description: '  Aluguel ', amount: '1.200,00', date: '2026-10-05' }, '2026-10', 'outubro')
    assert.deepEqual(r, { ok: true, value: { date: '2026-10-05', description: 'Aluguel', amount: 1200 } })
  })

  it('recusa descrição vazia, valor zero e data fora do mês', () => {
    const check = (d: { description: string; amount: string; date: string }) => checkExpense(d, '2026-10', 'outubro')
    assert.deepEqual(check({ description: ' ', amount: '10', date: '2026-10-05' }), { ok: false, error: 'Descreva a saída.' })
    assert.deepEqual(check({ description: 'Luz', amount: '0', date: '2026-10-05' }), { ok: false, error: 'Informe um valor maior que zero.' })
    assert.deepEqual(check({ description: 'Luz', amount: '10', date: '2026-09-30' }), { ok: false, error: 'A data precisa estar em outubro.' })
  })

  it('data inicial: hoje no mês atual e o último dia nos meses encerrados', () => {
    const now = new Date(2026, 9, 12)
    assert.equal(defaultExpenseDate(new Date(2026, 9, 1), true, now), '2026-10-12')
    assert.equal(defaultExpenseDate(new Date(2026, 8, 1), false, now), '2026-09-30')
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calendarWeeks, isWholeMonth, monthRange, periodPresets, pickDay } from './period'

const day = (m: number, d: number) => new Date(2026, m - 1, d)

describe('período do filtro', () => {
  it('só o mês inteiro conta como mês (e pode ser fechado)', () => {
    assert.equal(isWholeMonth(monthRange(day(10, 12))), true)
    assert.equal(isWholeMonth({ from: day(10, 1), to: day(10, 30) }), false)
    assert.equal(isWholeMonth({ from: day(10, 2), to: day(10, 31) }), false)
  })

  it('atalhos: hoje, 7 e 30 dias terminam hoje; mês passado é o mês anterior inteiro', () => {
    const p = Object.fromEntries(periodPresets(new Date(2026, 9, 12, 15)).map((x) => [x.id, x.range]))
    assert.deepEqual(p['hoje'], { from: day(10, 12), to: day(10, 12) })
    assert.deepEqual(p['7d'], { from: day(10, 6), to: day(10, 12) })
    assert.deepEqual(p['30d'], { from: day(9, 13), to: day(10, 12) })
    assert.deepEqual(p['mes-passado'], { from: day(9, 1), to: day(9, 30) })
  })

  it('dois cliques fecham o período, na ordem certa mesmo clicando de trás para frente', () => {
    const first = pickDay(null, day(10, 20))
    assert.equal(first.range, null)
    const second = pickDay(first.anchor, day(10, 5))
    assert.deepEqual(second.range, { from: day(10, 5), to: day(10, 20) })
    assert.equal(second.anchor, null)
  })

  it('clicar duas vezes no mesmo dia escolhe só aquele dia', () => {
    const second = pickDay(pickDay(null, day(10, 7)).anchor, day(10, 7))
    assert.deepEqual(second.range, { from: day(10, 7), to: day(10, 7) })
  })

  it('calendário começa na segunda e completa as semanas com vazios', () => {
    const weeks = calendarWeeks(day(10, 1)) // 1/out/2026 é quinta
    assert.equal(weeks[0].filter((d) => d === null).length, 3)
    assert.equal(weeks[0][3]?.getDate(), 1)
    assert.ok(weeks.every((w) => w.length === 7))
    assert.equal(weeks.flat().filter(Boolean).length, 31)
  })
})

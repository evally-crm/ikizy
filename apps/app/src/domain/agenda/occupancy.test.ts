import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dayLoad } from './occupancy'

const appt = (status: 'confirmado' | 'concluido' | 'cancelado' | 'faltou', duration: number, price = 100) => ({ professionalId: 'p1', duration, price, status })

describe('ocupação do dia', () => {
  it('soma o expediente do dia da semana e o que está marcado', () => {
    const hours = { p1: [{ weekday: 4, start: 9 * 60, end: 12 * 60 }, { weekday: 4, start: 13 * 60, end: 18 * 60 }, { weekday: 5, start: 9 * 60, end: 18 * 60 }] }
    const load = dayLoad([appt('confirmado', 120), appt('concluido', 60, 80)], ['p1'], hours, 4)
    assert.equal(load.capacity, 8 * 60)
    assert.equal(load.booked, 180)
    assert.equal(load.pct, 38)
    assert.equal(load.free, 300)
    assert.equal(load.received, 80)
  })

  it('cancelado e falta não ocupam; sem horário cadastrado vale a grade padrão', () => {
    const load = dayLoad([appt('cancelado', 60), appt('faltou', 60)], ['p1'], {}, 4)
    assert.equal(load.booked, 0)
    assert.equal(load.capacity, 12 * 60)
  })

  it('dia de folga: sem expediente, 0% e nada livre', () => {
    const load = dayLoad([], ['p1'], { p1: [{ weekday: 1, start: 540, end: 1080 }] }, 0)
    assert.deepEqual([load.capacity, load.pct, load.free], [0, 0, 0])
  })
})

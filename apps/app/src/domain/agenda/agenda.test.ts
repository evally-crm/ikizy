import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AppointmentStatus } from '../../types'
import { findConflict } from './conflict'
import { STATUS_NAME, appointmentsOn, countByDay, earliestStart, nextStep, summarizeDay } from './day'
import { HOUR_HEIGHT, blockHeight, gridHeight, gridHours, minuteAt, proTone, scrollTopFor, showsNow, yFor } from './grid'

const appt = (over: { id: string } & Partial<{ professionalId: string; date: string; start: number; duration: number; price: number; status: AppointmentStatus }>) => ({
  professionalId: 'p1',
  date: '2026-10-12',
  start: 600,
  duration: 60,
  price: 100,
  status: 'confirmado' as AppointmentStatus,
  ...over,
})

describe('conflito de horário', () => {
  const list = [appt({ id: 'a', start: 600, duration: 60 })]
  const slot = (start: number, duration = 60, over = {}) => ({ professionalId: 'p1', date: '2026-10-12', start, duration, ...over })

  it('acusa sobreposição da mesma profissional no mesmo dia', () => {
    assert.equal(findConflict(list, slot(630))?.id, 'a')
    assert.equal(findConflict(list, slot(540, 90))?.id, 'a')
  })

  it('horários encostados, outra profissional ou outro dia não conflitam', () => {
    assert.equal(findConflict(list, slot(660)), undefined)
    assert.equal(findConflict(list, slot(540)), undefined)
    assert.equal(findConflict(list, slot(600, 60, { professionalId: 'p2' })), undefined)
    assert.equal(findConflict(list, slot(600, 60, { date: '2026-10-13' })), undefined)
  })

  it('cancelado e falta não ocupam horário, e o próprio atendimento é ignorado', () => {
    assert.equal(findConflict([appt({ id: 'a', status: 'cancelado' })], slot(600)), undefined)
    assert.equal(findConflict([appt({ id: 'a', status: 'faltou' })], slot(600)), undefined)
    assert.equal(findConflict(list, slot(600), 'a'), undefined)
  })
})

describe('números do dia', () => {
  const list = [
    appt({ id: '1', start: 540, price: 80, status: 'concluido' }),
    appt({ id: '2', start: 780, price: 120, status: 'pendente' }),
    appt({ id: '3', start: 900, price: 200, status: 'confirmado' }),
    appt({ id: '4', start: 960, price: 50, status: 'faltou' }),
    appt({ id: '5', start: 1000, price: 70, status: 'cancelado' }),
    appt({ id: '6', date: '2026-10-13', price: 999 }),
  ]

  it('lista o dia sem cancelados e conta por dia', () => {
    assert.deepEqual(appointmentsOn(list, '2026-10-12').map((a) => a.id), ['1', '2', '3', '4'])
    const counts = countByDay(list)
    assert.equal(counts.get('2026-10-12'), 4)
    assert.equal(counts.get('2026-10-13'), 1)
  })

  it('resume previsto, pedidos, concluídos e o próximo atendimento', () => {
    const s = summarizeDay(list, '2026-10-12', 12 * 60)
    assert.equal(s.count, 4)
    assert.equal(s.expected, 400) // sem a falta
    assert.equal(s.awaiting, 1)
    assert.equal(s.concluded, 1)
    assert.equal(s.next?.id, '2')
  })

  it('em outro dia mostra o primeiro do dia e, fora do horário de hoje, não sobra nenhum', () => {
    assert.equal(summarizeDay(list, '2026-10-12', null).next?.id, '1')
    assert.equal(summarizeDay(list, '2026-10-12', 23 * 60).next, null)
  })

  it('acha o primeiro horário e nomeia cada status', () => {
    assert.equal(earliestStart([{ start: 900 }, { start: 540 }]), 540)
    assert.equal(earliestStart([]), null)
    assert.equal(STATUS_NAME.pendente, 'aguardando')
  })

  it('próximo passo: confirmar, iniciar ou concluir', () => {
    assert.deepEqual((['pendente', 'confirmado', 'atendimento'] as const).map(nextStep), ['confirm', 'start', 'conclude'])
  })
})

describe('geometria da grade', () => {
  it('posiciona e dimensiona os blocos', () => {
    assert.equal(yFor(9 * 60, 8), HOUR_HEIGHT)
    assert.equal(blockHeight(30), HOUR_HEIGHT / 2 - 4)
    assert.equal(gridHeight(8, 20), 12 * HOUR_HEIGHT)
    assert.deepEqual(gridHours(8, 11), [8, 9, 10])
  })

  it('o clique vira horário de 15 em 15 minutos', () => {
    assert.equal(minuteAt(0, 8), 8 * 60)
    assert.equal(minuteAt(HOUR_HEIGHT / 2, 8), 8 * 60 + 30)
    assert.equal(minuteAt(HOUR_HEIGHT * 1.3, 8), 9 * 60 + 15)
  })

  it('linha de agora, rolagem inicial e tom da profissional', () => {
    assert.equal(showsNow(true, 10 * 60, 8, 20), true)
    assert.equal(showsNow(true, 21 * 60, 8, 20), false)
    assert.equal(showsNow(false, 10 * 60, 8, 20), false)
    assert.equal(scrollTopFor(8 * 60, 8), 0)
    assert.equal(scrollTopFor(11 * 60, 8), 2 * HOUR_HEIGHT)
    assert.deepEqual([0, 1, 5, 6].map(proTone), [1, 2, 6, 1])
  })
})

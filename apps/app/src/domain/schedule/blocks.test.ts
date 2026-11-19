import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blockOnDayLabel, blocksOfDay, checkBlock, describeBlock, upcomingBlocks, type BlockForm, type TimeBlock } from './blocks.js'

const now = new Date('2026-11-18T12:00:00-03:00')
const form = (over: Partial<BlockForm> = {}): BlockForm => ({
  professionalId: '',
  startDate: '2026-11-20',
  endDate: '2026-11-20',
  allDay: true,
  startTime: '10:00',
  endTime: '12:00',
  reason: ' Férias ',
  ...over,
})

describe('checkBlock', () => {
  it('dia inteiro: de meia-noite à meia-noite do dia seguinte, em Brasília', () => {
    const r = checkBlock(form(), now)
    assert.ok(r.ok)
    assert.equal(r.value.startsAt, '2026-11-20T03:00:00.000Z')
    assert.equal(r.value.endsAt, '2026-11-21T03:00:00.000Z')
    assert.equal(r.value.professionalId, null)
    assert.equal(r.value.reason, 'Férias')
  })

  it('vários dias inteiros incluem o último dia', () => {
    const r = checkBlock(form({ endDate: '2026-11-22' }), now)
    assert.ok(r.ok)
    assert.equal(r.value.endsAt, '2026-11-23T03:00:00.000Z')
  })

  it('por horas: vale um dia só e usa os horários', () => {
    const r = checkBlock(form({ allDay: false, endDate: '2026-12-31', professionalId: 'p1' }), now)
    assert.ok(r.ok)
    assert.equal(r.value.startsAt, '2026-11-20T13:00:00.000Z')
    assert.equal(r.value.endsAt, '2026-11-20T15:00:00.000Z')
    assert.equal(r.value.professionalId, 'p1')
  })

  it('recusa fim antes do início, horário invertido, período passado e mais de um ano', () => {
    assert.equal(checkBlock(form({ endDate: '2026-11-19' }), now).ok, false)
    assert.equal(checkBlock(form({ allDay: false, startTime: '12:00', endTime: '10:00' }), now).ok, false)
    assert.equal(checkBlock(form({ startDate: '2026-11-10', endDate: '2026-11-10' }), now).ok, false)
    assert.equal(checkBlock(form({ endDate: '2028-01-01' }), now).ok, false)
    assert.equal(checkBlock(form({ startDate: '' }), now).ok, false)
  })
})

describe('describeBlock', () => {
  const day = (startsAt: string, endsAt: string) => describeBlock({ startsAt, endsAt })
  it('um dia inteiro, vários dias e por horas', () => {
    assert.equal(day('2026-11-20T03:00:00.000Z', '2026-11-21T03:00:00.000Z'), 'Sex, 20 nov · dia inteiro')
    assert.equal(day('2026-11-20T03:00:00.000Z', '2026-11-23T03:00:00.000Z'), '20 nov a 22 nov · dia inteiro')
    assert.equal(day('2026-11-20T13:00:00.000Z', '2026-11-20T15:00:00.000Z'), 'Sex, 20 nov · 10h às 12h')
    assert.equal(day('2026-11-20T16:30:00.000Z', '2026-11-20T17:00:00.000Z'), 'Sex, 20 nov · 13h30 às 14h')
  })
})

describe('blockOnDayLabel', () => {
  it('dia inteiro, horas e bloqueio de vários dias recortado ao dia', () => {
    const range = { startsAt: '2026-11-20T03:00:00.000Z', endsAt: '2026-11-23T03:00:00.000Z' }
    assert.equal(blockOnDayLabel(range, '2026-11-21'), 'dia inteiro')
    assert.equal(blockOnDayLabel({ startsAt: '2026-11-20T13:00:00.000Z', endsAt: '2026-11-20T15:00:00.000Z' }, '2026-11-20'), '10h às 12h')
    assert.equal(blockOnDayLabel({ startsAt: '2026-11-20T20:00:00.000Z', endsAt: '2026-11-22T12:00:00.000Z' }, '2026-11-20'), '17h às 24h')
  })
})

describe('blocksOfDay e upcomingBlocks', () => {
  const mk = (id: string, pro: string | null, startsAt: string, endsAt: string): TimeBlock => ({ id, professionalId: pro, startsAt, endsAt, reason: '' })
  const all = mk('a', null, '2026-11-20T13:00:00.000Z', '2026-11-20T15:00:00.000Z')
  const mine = mk('b', 'p1', '2026-11-20T03:00:00.000Z', '2026-11-21T03:00:00.000Z')
  const other = mk('c', 'p2', '2026-11-20T03:00:00.000Z', '2026-11-21T03:00:00.000Z')
  const old = mk('d', null, '2026-11-01T03:00:00.000Z', '2026-11-02T03:00:00.000Z')

  it('mostra os da profissional e os de todas naquele dia', () => {
    assert.deepEqual(blocksOfDay([all, mine, other], '2026-11-20', 'p1').map((b) => b.id), ['b', 'a'])
    assert.deepEqual(blocksOfDay([all, mine, other], '2026-11-21').map((b) => b.id), [])
    assert.equal(blocksOfDay([all, mine, other], '2026-11-20').length, 3)
  })

  it('esconde os que já terminaram', () => {
    assert.deepEqual(upcomingBlocks([old, all], now).map((b) => b.id), ['a'])
  })
})

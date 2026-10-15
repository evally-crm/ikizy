import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { awaitsConfirmation, filterClients, summarizeBook, type BookClient } from './book'
import { confirmsClientName } from './forget'
import { clientProfile, type ProfileClient } from './profile'
import { DEFAULT_INTERVAL, MISSING_AFTER, averageInterval, clientTags, daysSince, lastVisitLabel } from './tags'

const TODAY = new Date(2026, 9, 12)
const daysAgo = (n: number) => new Date(2026, 9, 12 - n)

const client = (over: Partial<BookClient & ProfileClient> & { id: string }): BookClient & ProfileClient & { lastVisit: Date } => ({
  name: 'Ana',
  phone: '11987654321',
  since: daysAgo(200),
  lastVisit: daysAgo(10),
  birthday: '',
  vip: false,
  visits: 3,
  totalSpent: 600,
  interval: 30,
  anamnesisSignedAt: null,
  appointments: [],
  ...over,
})

describe('marcações', () => {
  it('VIP, nova, sumida e aniversariante do mês', () => {
    assert.deepEqual(clientTags(client({ id: '1', vip: true }), TODAY), ['vip'])
    assert.deepEqual(clientTags(client({ id: '2', since: daysAgo(30) }), TODAY), ['nova'])
    assert.deepEqual(clientTags(client({ id: '3', since: daysAgo(31) }), TODAY), [])
    assert.deepEqual(clientTags(client({ id: '4', lastVisit: daysAgo(MISSING_AFTER + 1) }), TODAY), ['sumida'])
    assert.deepEqual(clientTags(client({ id: '5', lastVisit: daysAgo(MISSING_AFTER) }), TODAY), [])
    assert.deepEqual(clientTags(client({ id: '6', birthday: '10-25' }), TODAY), ['aniversario'])
    assert.deepEqual(clientTags(client({ id: '7', birthday: '' }), TODAY), [])
  })

  it('dias desde a visita e o texto da última visita', () => {
    assert.equal(daysSince(daysAgo(7), TODAY), 7)
    assert.deepEqual([0, 1, 5].map(lastVisitLabel), ['Veio hoje', 'Veio ontem', 'Última visita há 5 dias'])
  })

  it('intervalo médio entre visitas, com padrão para menos de duas', () => {
    assert.equal(averageInterval([]), DEFAULT_INTERVAL)
    assert.equal(averageInterval([daysAgo(0)]), DEFAULT_INTERVAL)
    assert.equal(averageInterval([daysAgo(0), daysAgo(20), daysAgo(40)]), 20)
    assert.equal(averageInterval([daysAgo(1), daysAgo(1)]), 1)
  })
})

describe('lista de contatos', () => {
  const list = [
    client({ id: 'a', name: 'Ana Clara', phone: '11911112222', lastVisit: daysAgo(5) }),
    client({ id: 'b', name: 'Beatriz Sousa', phone: '11933334444', lastVisit: daysAgo(60) }),
    client({ id: 'c', name: 'Carol Luz', phone: '', lastVisit: daysAgo(1), vip: true }),
  ]

  it('ordena da visita mais recente para a mais antiga', () => {
    assert.deepEqual(filterClients(list, '', 'todas', TODAY).map((c) => c.id), ['c', 'a', 'b'])
  })

  it('busca por nome sem acento e por telefone', () => {
    assert.deepEqual(filterClients(list, 'BEATRIZ', 'todas', TODAY).map((c) => c.id), ['b'])
    assert.deepEqual(filterClients(list, '3333', 'todas', TODAY).map((c) => c.id), ['b'])
    assert.deepEqual(filterClients(list, 'xyz', 'todas', TODAY), [])
  })

  it('filtra pela marcação', () => {
    assert.deepEqual(filterClients(list, '', 'vip', TODAY).map((c) => c.id), ['c'])
    assert.deepEqual(filterClients(list, '', 'sumida', TODAY).map((c) => c.id), ['b'])
  })

  it('resume ativas, novas, retorno e sumidas', () => {
    const s = summarizeBook([...list, client({ id: 'd', since: daysAgo(3), visits: 1 })], TODAY)
    assert.deepEqual(s, { active: 4, newOnes: 1, returningPct: 75, missing: 1 })
    assert.equal(summarizeBook([], TODAY).returningPct, 0)
  })

  it('pedido do site pendente no futuro conta como "a confirmar"', () => {
    const future = new Date(2026, 9, 20)
    assert.equal(awaitsConfirmation({ appointments: [{ status: 'pendente', date: future }] }, TODAY), true)
    assert.equal(awaitsConfirmation({ appointments: [{ status: 'pendente', date: daysAgo(2) }] }, TODAY), false)
    assert.equal(awaitsConfirmation({ appointments: [{ status: 'confirmado', date: future }] }, TODAY), false)
  })
})

describe('perfil da cliente', () => {
  it('cliente nova, sem visitas: sem números e sem retorno', () => {
    const p = clientProfile(client({ id: '1', visits: 0, totalSpent: 0, lastVisit: daysAgo(2) }), TODAY, 0)
    assert.equal(p.hasVisits, false)
    assert.equal(p.ticket, 0)
    assert.equal(p.overdue, 0)
    assert.deepEqual(p.returnState, { kind: 'none' })
    assert.equal(p.suggested, 'livre')
  })

  it('retorno em dia mostra a data prevista; atrasado pede manutenção', () => {
    const ok = clientProfile(client({ id: '1', lastVisit: daysAgo(10), interval: 30 }), TODAY, 0)
    assert.equal(ok.returnState.kind, 'expected')
    assert.equal(ok.ticket, 200)

    const late = clientProfile(client({ id: '2', lastVisit: daysAgo(40), interval: 30 }), TODAY, 0)
    assert.deepEqual(late.returnState, { kind: 'late', days: 10 })
    assert.equal(late.suggested, 'manutencao')
  })

  it('sumida sugere o convite de retorno', () => {
    const p = clientProfile(client({ id: '1', lastVisit: daysAgo(60), interval: 30 }), TODAY, 0)
    assert.deepEqual(p.returnState, { kind: 'missing', days: 60 })
    assert.equal(p.suggested, 'sumida')
  })

  it('próximo horário marcado vem antes de qualquer aviso de atraso', () => {
    const when = new Date(2026, 9, 20, 14, 0)
    const p = clientProfile(
      client({ id: '1', lastVisit: daysAgo(60), appointments: [{ status: 'pendente', date: when, service: 'Esmaltação' }] }),
      TODAY,
      0,
    )
    assert.deepEqual(p.returnState, { kind: 'upcoming', when, service: 'Esmaltação', awaiting: true })
  })

  it('aniversariante ganha a mensagem de aniversário e a ficha só conta assinada e respondida', () => {
    assert.equal(clientProfile(client({ id: '1', birthday: '10-30' }), TODAY, 0).suggested, 'aniversario')
    assert.equal(clientProfile(client({ id: '2', anamnesisSignedAt: daysAgo(3) }), TODAY, 5).fileDone, true)
    assert.equal(clientProfile(client({ id: '3', anamnesisSignedAt: daysAgo(3) }), TODAY, 0).fileDone, false)
    assert.equal(clientProfile(client({ id: '4' }), TODAY, 5).fileDone, false)
  })
})

describe('apagar dados da cliente', () => {
  it('confirma pelo nome, sem diferença de acento, caixa ou espaços', () => {
    assert.equal(confirmsClientName('  maria   JOSÉ ', 'Maria José'), true)
    assert.equal(confirmsClientName('Maria', 'Maria José'), false)
    assert.equal(confirmsClientName('', ''), false)
  })
})

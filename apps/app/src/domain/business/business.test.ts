import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { filterServices, summarizeBusiness, usageByProduct, type CatalogProduct, type CatalogService } from './catalog'
import { hoursSpan, openStatus, placeBlock, summarizeHours, weekDays } from './hours'
import { serviceMargin } from './margin'

const svc = (over: Partial<CatalogService> & { id: string }): CatalogService => ({
  name: 'Serviço',
  category: 'Unhas',
  price: 100,
  productId: null,
  monthlyVolume: 0,
  ...over,
})
const gel: CatalogProduct = { id: 'gel', name: 'Gel', monthlySpend: 300 }

describe('margem do serviço', () => {
  it('divide o gasto do material entre todos os atendimentos que o usam', () => {
    const a = svc({ id: 'a', price: 200, productId: 'gel', monthlyVolume: 10 })
    const b = svc({ id: 'b', price: 100, productId: 'gel', monthlyVolume: 20 })
    const m = serviceMargin(a, [a, b], [gel])
    assert.equal(m.cost, 10)
    assert.equal(m.margin, 190)
    assert.equal(m.marginPct, 95)
  })

  it('sem material, sem volume ou sem preço não quebra', () => {
    const a = svc({ id: 'a', price: 0, productId: 'gel', monthlyVolume: 0 })
    assert.deepEqual(serviceMargin(a, [a], [gel]), { cost: 0, margin: 0, marginPct: 0 })
    assert.equal(serviceMargin(svc({ id: 'b', price: 80 }), [], []).margin, 80)
  })
})

describe('resumo do negócio', () => {
  it('conta serviços sem preço, sobra média e gasto de material', () => {
    const a = svc({ id: 'a', price: 200, productId: 'gel', monthlyVolume: 10 })
    const b = svc({ id: 'b', price: 0 })
    const s = summarizeBusiness([a, b], [gel])
    assert.equal(s.serviceCount, 2)
    assert.equal(s.unpriced, 1)
    assert.equal(s.averageMarginPct, 85)
    assert.equal(s.materialSpend, 300)
  })

  it('sem serviço com material, a sobra média fica indefinida', () => {
    assert.equal(summarizeBusiness([svc({ id: 'a' })], []).averageMarginPct, null)
  })
})

describe('catálogo', () => {
  const list = [svc({ id: '1', name: 'Esmaltação em gel' }), svc({ id: '2', name: 'Sobrancelha', category: 'Sobrancelha' }), svc({ id: '3', name: 'Alongamento' })]

  it('busca sem acento nem caixa e filtra por categoria', () => {
    assert.deepEqual(filterServices(list, 'ESMALTACAO', '').map((s) => s.id), ['1'])
    assert.deepEqual(filterServices(list, 'sobrancelha', '').map((s) => s.id), ['2']) // acha pela categoria
    assert.deepEqual(filterServices(list, '', 'Sobrancelha').map((s) => s.id), ['2'])
    assert.deepEqual(filterServices(list, 'gel', 'Sobrancelha'), [])
    assert.equal(filterServices(list, '', '').length, 3)
  })

  it('conta quantos serviços usam cada material', () => {
    assert.deepEqual(usageByProduct([svc({ id: '1', productId: 'gel' }), svc({ id: '2', productId: 'gel' }), svc({ id: '3' })]), { gel: 2 })
  })
})

describe('horários', () => {
  const week = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: 9 * 60, end: 18 * 60 }))

  it('junta dias seguidos com o mesmo horário', () => {
    assert.deepEqual(summarizeHours([...week, { weekday: 6, start: 9 * 60, end: 13 * 60 }]), ['Seg a Sex · 09:00–18:00', 'Sáb · 09:00–13:00'])
    assert.deepEqual(summarizeHours(undefined), [])
  })

  it('monta a semana de segunda a domingo', () => {
    const days = weekDays(week)
    assert.deepEqual(days.map((d) => d.label), ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])
    assert.equal(days[0].blocks.length, 1)
    assert.equal(days[5].blocks.length, 0)
  })

  it('a faixa da grade vai da primeira à última hora cheia, com padrão de 8h às 20h', () => {
    assert.deepEqual(hoursSpan([week]), { from: 9 * 60, to: 18 * 60 })
    assert.deepEqual(hoursSpan([[{ weekday: 1, start: 8 * 60 + 30, end: 19 * 60 + 10 }]]), { from: 8 * 60, to: 20 * 60 })
    assert.deepEqual(hoursSpan([]), { from: 8 * 60, to: 20 * 60 })
  })

  it('diz se está aberto agora, até quando, e quando abre de novo', () => {
    const monday = (h: number, m = 0) => new Date(2026, 9, 12, h, m) // 12/10/2026 é segunda
    assert.deepEqual(openStatus(week, monday(10)), { open: true, until: 18 * 60 })
    assert.deepEqual(openStatus(week, monday(7)), { open: false, opensAt: 9 * 60 })
    assert.deepEqual(openStatus(week, monday(19)), { open: false, opensAt: null })
    assert.deepEqual(openStatus(week, new Date(2026, 9, 11, 10)), { open: false, opensAt: null }) // domingo
  })

  it('posiciona o bloco na grade em porcentagem da faixa', () => {
    const span = { from: 8 * 60, to: 20 * 60 }
    assert.deepEqual(placeBlock({ weekday: 1, start: 8 * 60, end: 14 * 60 }, span), { top: 0, height: 50 })
    assert.deepEqual(placeBlock({ weekday: 1, start: 14 * 60, end: 20 * 60 }, span), { top: 50, height: 50 })
  })
})

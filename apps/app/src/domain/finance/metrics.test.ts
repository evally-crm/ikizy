import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bestDay, bestWeekIndex, composition, dailyRange, growthPct, marginPct, monthSummaryText, outflowOf, paymentShares, pct, waffleCounts, weeklyAverage, weeksOf } from './metrics'
import { buildDayReceipt, buildMonthReceipt } from './receipt'
import { buildDayStatement } from './day'
import { appt } from './fixtures.test-helpers'
import type { MonthClosing } from './types'

const month = (over: Partial<MonthClosing> = {}): MonthClosing => ({
  id: '2026-10',
  date: new Date(2026, 9, 1),
  label: 'outubro',
  isCurrent: false,
  closedAt: null,
  daysInMonth: 31,
  elapsedDays: 31,
  categories: [{ name: 'Unhas', qty: 3, total: 300 }],
  gross: 1000,
  cardFees: 31,
  products: 100,
  expenses: 50,
  commissions: [],
  commissionsTotal: 119,
  net: 700,
  payments: [
    { method: 'Pix', total: 600 },
    { method: 'Crédito', total: 400 },
  ],
  appointments: 10,
  ticket: 100,
  newClients: 2,
  returnRate: 60,
  noShows: 1,
  daily: Array.from({ length: 31 }, (_, i) => (i === 4 ? 400 : i === 10 ? 600 : 0)),
  ...over,
})

describe('indicadores do mês', () => {
  it('percentual com total zero não quebra', () => {
    assert.equal(pct(5, 0), 0)
    assert.equal(pct(1, 3), 33)
  })

  it('crescimento compara com o mês anterior e é nulo sem base', () => {
    assert.equal(growthPct(month({ gross: 1200 }), month({ gross: 1000 })), 20)
    assert.equal(growthPct(month({ gross: 800 }), month({ gross: 1000 })), -20)
    assert.equal(growthPct(month(), undefined), null)
    assert.equal(growthPct(month(), month({ gross: 0 })), null)
  })

  it('margem nunca é negativa e a saída soma tudo que saiu', () => {
    assert.equal(marginPct(month({ net: 250, gross: 1000 })), 25)
    assert.equal(marginPct(month({ net: -300 })), 0)
    assert.equal(outflowOf(month()), 119 + 100 + 50 + 31)
  })

  it('composição mostra só o que existe e o lucro sempre', () => {
    const parts = composition(month({ expenses: 0, commissionsTotal: 0 }))
    assert.deepEqual(parts.map((p) => p.tone), ['net', 'products', 'fees'])
    assert.equal(parts[0].share, 70)
    assert.deepEqual(composition(month({ net: -10, products: 0, expenses: 0, commissionsTotal: 0, cardFees: 0 })).map((p) => p.tone), ['net'])
  })

  it('semanas, melhor semana, média e melhor dia', () => {
    const m = month()
    const weeks = weeksOf(m)
    assert.equal(weeks.length, 5)
    assert.equal(weeks[0].total, 400)
    assert.equal(weeks[1].total, 600)
    assert.equal(bestWeekIndex(weeks), 1)
    assert.equal(weeklyAverage(m), 200)
    assert.deepEqual(bestDay(m), { day: 11, value: 600 })
    assert.deepEqual(dailyRange(m), [400, 600])
  })

  it('mês sem faturamento: sem melhor dia, sem média, sem melhor semana', () => {
    const empty = month({ gross: 0, daily: Array.from({ length: 31 }, () => 0) })
    assert.equal(bestDay(empty), null)
    assert.equal(weeklyAverage(empty), 0)
    assert.equal(bestWeekIndex(weeksOf(empty)), -1)
  })

  it('dias futuros do mês em andamento ficam de fora da média', () => {
    const current = month({ isCurrent: true, elapsedDays: 10, daily: [...Array.from({ length: 10 }, () => 100), ...Array.from({ length: 21 }, () => null)], gross: 1000 })
    const weeks = weeksOf(current)
    assert.equal(weeks.filter((w) => w.future).length, 3)
    assert.equal(weeks[1].current, true)
    assert.equal(weeklyAverage(current), 500)
  })

  it('formas de pagamento: parte de cada uma e barra relativa à maior', () => {
    const shares = paymentShares(month().payments)
    assert.deepEqual(shares.map((s) => [s.share, s.top]), [[60, true], [40, false]])
    assert.ok(Math.abs(shares[1].relative - 2 / 3) < 1e-9)
  })

  it('grade de pontos reparte exatamente 50 pontos', () => {
    const counts = waffleCounts([700, 119, 100, 50, 31], 1000)
    assert.equal(counts.reduce((a, b) => a + b, 0), 50)
    assert.deepEqual(waffleCounts([0, 0], 0), [0, 0])
  })

  it('resumo para o WhatsApp traz mês, salão, faturamento, lucro e atendimentos', () => {
    const text = monthSummaryText(month(), 'Studio Aurora')
    assert.match(text, /Fechamento de outubro - Studio Aurora/)
    assert.match(text, /Atendimentos: 10/)
  })
})

describe('recibos', () => {
  const now = new Date(2026, 9, 12, 15, 30)

  it('recibo do mês aberto é prévia; fechado traz a data do fechamento', () => {
    const open = buildMonthReceipt(month(), null, { salonName: 'Studio Aurora', now })
    assert.equal(open.preview, true)
    assert.equal(open.number, '202610')
    assert.match(open.footer, /Valores parciais até 12\/10/)

    const closed = buildMonthReceipt(month(), new Date(2026, 10, 1, 9, 5), { salonName: 'Studio Aurora', now })
    assert.equal(closed.closed, true)
    assert.match(closed.footer, /Fechado em 01\/11\/2026 às 09:05/)
  })

  it('comissões e despesas só aparecem no recibo quando existem', () => {
    const none = buildMonthReceipt(month({ commissionsTotal: 0, expenses: 0 }), null, { salonName: 'S', now })
    assert.deepEqual(none.sums.map((s) => s.label), ['Faturamento bruto', '(-) Produtos', '(-) Taxas de cartão', 'Lucro líquido'])
    const withAll = buildMonthReceipt(month(), null, { salonName: 'S', now })
    assert.equal(withAll.sums.at(-1)?.total, true)
    assert.equal(withAll.sums.length, 6)
  })

  it('recibo do dia lista os atendimentos e fecha o resultado do dia', () => {
    const day = buildDayStatement({
      date: '2026-10-12',
      professionals: [],
      expenses: [],
      appointments: [appt({ id: '1', price: 120, startsAt: new Date(2026, 9, 12, 9, 0) })],
    })
    const r = buildDayReceipt(day, { salonName: 'Studio Aurora', now })
    assert.equal(r.kind, 'day')
    assert.equal(r.preview, true)
    assert.equal(r.number, '20261012')
    assert.deepEqual(r.lines.map((l) => l.total), [120])
    assert.equal(r.sums.at(-1)?.value, 120)
    assert.equal(r.chart, null)
  })
})

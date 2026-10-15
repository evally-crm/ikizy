import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { barHeights, gaugeDash, heatLevel, linePoints } from './charts'

describe('geometria dos gráficos', () => {
  it('linha: pula dias futuros e põe o maior valor no topo', () => {
    const points = linePoints([0, 100, null, 50], 300, 70).split(' ')
    assert.equal(points.length, 3)
    assert.equal(points[1], '100.0,3.0')
    assert.equal(points[0], '0.0,67.0')
  })

  it('barras: a maior ocupa tudo, valores pequenos não somem e zero fica vazio', () => {
    assert.deepEqual(barHeights([400, 200, 10, 0]), [100, 50, 12, 0])
    assert.deepEqual(barHeights([0, 0]), [0, 0])
  })

  it('mapa de calor: níveis por faixa do melhor dia', () => {
    assert.deepEqual([0, 10, 30, 60, 100].map((v) => heatLevel(v, 100)), [0, 1, 2, 3, 4])
    assert.equal(heatLevel(null, 100), 0)
    assert.equal(heatLevel(50, 0), 0)
  })

  it('medidor: prende o valor entre 0 e 100', () => {
    assert.equal(gaugeDash(50, 200), '100 200')
    assert.equal(gaugeDash(150, 200), '200 200')
    assert.equal(gaugeDash(-5, 200), '0 200')
  })
})

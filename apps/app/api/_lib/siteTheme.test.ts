import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FONTS, PALETTES, isFontId, isPaletteId, paletteFor, type PaletteId } from '../../src/lib/siteTheme.js'

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('paletas fixas', () => {
  const ids = Object.keys(PALETTES) as PaletteId[]

  it('são as sete combinações escolhidas, todas com cores #rrggbb', () => {
    assert.equal(ids.length, 8)
    for (const id of ids) {
      for (const [k, v] of Object.entries(PALETTES[id])) {
        if (['label', 'dark'].includes(k)) continue
        assert.match(String(v), /^#[0-9a-f]{6}$/, `${id}.${k}`)
      }
    }
  })

  it('todas têm contraste legível (mínimo 4,5 para texto)', () => {
    for (const id of ids) {
      const p = PALETTES[id]
      assert.ok(contrast(p.ink, p.panel) >= 7, `${id}: título sobre painel`)
      assert.ok(contrast(p.text, p.bg) >= 7, `${id}: texto sobre fundo`)
      assert.ok(contrast(p.muted, p.panel) >= 4.5, `${id}: texto de apoio sobre painel`)
      assert.ok(contrast(p.accent, p.panel) >= 4.5, `${id}: destaque sobre painel (itálicos e preços)`)
      assert.ok(contrast(p.accent, p.soft) >= 4.5, `${id}: destaque sobre cartão suave`)
      assert.ok(contrast(p.on, p.accent) >= 4.5, `${id}: texto do botão sobre a cor de destaque`)
    }
  })
})

describe('paletteFor', () => {
  it('usa a paleta salva quando válida', () => {
    assert.equal(paletteFor({ palette: 'creme-pinho' }).id, 'creme-pinho')
  })

  it('escolhas antigas viram a combinação mais próxima', () => {
    assert.equal(paletteFor({ palette: 'noir' }).id, 'bege-preto')
    assert.equal(paletteFor({ palette: 'floresta' }).id, 'creme-pinho')
    assert.equal(paletteFor({ palette: 'marinho' }).id, 'marinho-branco')
    assert.equal(paletteFor({ accent: 'rubi', theme: 'escuro' }).id, 'bege-preto')
    assert.equal(paletteFor({ accent: 'rubi', theme: 'bege' }).id, 'branco-bege')
    assert.equal(paletteFor({ accent: 'vinho', theme: 'claro' }).id, 'vinho-preto')
  })

  it('valor desconhecido cai em vinho e preto', () => {
    assert.equal(paletteFor({ palette: 'neon', accent: 'x', theme: 'y' }).id, 'vinho-preto')
    assert.equal(paletteFor({}).id, 'vinho-preto')
    assert.ok(!isPaletteId('neon'))
  })
})

describe('fontes', () => {
  it('só aceita opções conhecidas', () => {
    assert.ok(isFontId('forte') && !isFontId('comic'))
    assert.equal(Object.keys(FONTS).length, 3)
  })
})

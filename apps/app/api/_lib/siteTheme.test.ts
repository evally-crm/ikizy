import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FONTS, THEMES, isFontId, isThemeId, resolveAccent } from '../../src/lib/siteTheme.js'

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('temas e fontes', () => {
  it('só aceita opções conhecidas', () => {
    assert.ok(isThemeId('escuro') && isThemeId('bege') && isThemeId('claro'))
    assert.ok(!isThemeId('neon') && !isThemeId(undefined))
    assert.ok(isFontId('forte') && !isFontId('comic'))
    assert.equal(Object.keys(THEMES).length, 3)
    assert.equal(Object.keys(FONTS).length, 3)
  })
})

describe('resolveAccent', () => {
  it('tema claro: texto branco sobre a cor tem contraste mínimo de 4,5', () => {
    for (const custom of ['', '#1a7f5a', '#ffee00', '#ffffff', '#00ffff']) {
      const a = resolveAccent('rubi', custom, 'claro')
      assert.equal(a.on, '#ffffff')
      assert.ok(contrast(a.color, '#ffffff') >= 4.5, `${custom || 'preset'} -> ${a.color}`)
    }
  })

  it('tema escuro: a cor tem contraste com o painel escuro e o botão usa texto legível', () => {
    for (const id of ['bordo', 'rubi', 'vinho']) {
      const a = resolveAccent(id, '', 'escuro')
      assert.ok(contrast(a.color, THEMES.escuro.panel) >= 4.5, `${id} -> ${a.color}`)
      assert.ok(contrast(a.color, a.on) >= 4.5, `${id} botão`)
    }
    const dark = resolveAccent('rubi', '#0b3d2e', 'escuro')
    assert.ok(contrast(dark.color, THEMES.escuro.panel) >= 4.5)
    assert.match(dark.color, /^#[0-9a-f]{6}$/)
  })

  it('cor inválida ou tema desconhecido cai nos padrões', () => {
    assert.equal(resolveAccent('neon', 'vermelho', 'xyz').color, '#460106')
  })
})

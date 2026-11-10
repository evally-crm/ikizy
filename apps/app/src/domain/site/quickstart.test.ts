import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { aboutIdeas, hoursSummary, quickSteps, taglineIdeas } from './quickstart'

const site = { logo: '', cover: '', tagline: '', about: '', whatsapp: '', address: '' }
const done = (input: Parameters<typeof quickSteps>[0]) => quickSteps(input).filter((s) => s.done).map((s) => s.id)

describe('seu site em 10 min', () => {
  it('site em branco: nada feito', () => {
    assert.deepEqual(done({ site, services: [], isLive: false, dirty: false }), [])
  })

  it('cada etapa marca sozinha', () => {
    const ok = done({
      site: { logo: '', cover: 'x', tagline: 'Oi', about: '', whatsapp: '11 9', address: 'Rua A' },
      services: [{ price: 50, visible: true }, { price: 0, visible: false }],
      isLive: true,
      dirty: false,
    })
    assert.deepEqual(ok, ['foto', 'textos', 'precos', 'contato', 'publicar'])
  })

  it('serviço no site sem preço e alteração pendente seguram as etapas', () => {
    const ok = done({ site, services: [{ price: 0, visible: true }], isLive: true, dirty: true })
    assert.ok(!ok.includes('precos'))
    assert.ok(!ok.includes('publicar'))
  })

  it('frases prontas: as da área primeiro, no máximo 3, todas cabem no campo', () => {
    const ideas = taglineIdeas(['Cílios'])
    assert.equal(ideas.length, 3)
    assert.match(ideas[0], /Olhar/)
    for (const t of ideas) assert.ok(t.length <= 70)
  })

  it('texto sobre usa o nome e as áreas e cabe em 220 letras', () => {
    const [first] = aboutIdeas('Studio Ana', ['Unhas', 'Cílios', 'Cabelo'])
    assert.match(first, /^Studio Ana é um espaço de unhas, cílios e cabelo/)
    for (const t of aboutIdeas('N'.repeat(40), ['Unhas', 'Cílios', 'Cabelo', 'Sobrancelha', 'Estética'])) assert.ok(t.length <= 220)
  })

  it('horário do site vem da agenda', () => {
    const week = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: 540, end: 1140 }))
    assert.equal(hoursSummary(week), 'Seg a Sáb · 09h às 19h')
    assert.equal(hoursSummary([{ weekday: 1, start: 510, end: 1080 }, { weekday: 3, start: 600, end: 1200 }, { weekday: 5, start: 600, end: 1080 }]), 'Seg, Qua e Sex · 08h30 às 20h')
    assert.equal(hoursSummary([{ weekday: 6, start: 540, end: 720 }, { weekday: 0, start: 540, end: 720 }]), 'Sáb e Dom · 09h às 12h')
    assert.equal(hoursSummary([]), '')
  })
})

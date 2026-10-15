import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blankPlan, blankShowcaseItem, patchById, removeById } from './lists'
import { cleanSlug, clampIndex, depositPercent, noticeHours, parseAmount, hasPendingPublish, publishButton, splitIncludes, windowDays, type PublishState } from './rules'

describe('campos do site', () => {
  it('valor digitado vira número não negativo', () => {
    assert.equal(parseAmount('12,5'), 12.5)
    assert.equal(parseAmount('12.5'), 12.5)
    assert.equal(parseAmount('-3'), 0)
    assert.equal(parseAmount('abc'), 0)
  })

  it('endereço da página só aceita minúsculas, números e hífen', () => {
    assert.equal(cleanSlug('Studio Ana_2!'), 'studioana2')
    assert.equal(cleanSlug('meu-salao'), 'meu-salao')
  })

  it('antecedência, janela e sinal respeitam os limites', () => {
    assert.equal(noticeHours('500'), 168)
    assert.equal(noticeHours('2,6'), 3)
    assert.equal(windowDays('0'), 1)
    assert.equal(windowDays('200'), 90)
    assert.equal(depositPercent('150'), 100)
    assert.equal(depositPercent('30'), 30)
  })

  it('o que o plano inclui: uma linha por item, até 8', () => {
    assert.deepEqual(splitIncludes('a\nb'), ['a', 'b'])
    assert.equal(splitIncludes(Array.from({ length: 12 }, (_, i) => `i${i}`).join('\n')).length, 8)
  })

  it('índice de etapa fica sempre dentro da lista', () => {
    assert.deepEqual([-1, 0, 2, 9].map((i) => clampIndex(i, 3)), [0, 0, 2, 2])
  })
})

describe('botão de publicar', () => {
  const base: PublishState = { isLive: true, dirty: false, justPublished: false, publishing: false, loading: false, reserved: false }

  it('topo: tudo publicado fica desligado; alterações liberam; recém-publicado mostra confirmação', () => {
    assert.deepEqual(publishButton(base, 'header'), { label: 'Tudo publicado', disabled: true })
    assert.deepEqual(publishButton({ ...base, dirty: true }, 'header'), { label: 'Publicar alterações', disabled: false })
    assert.deepEqual(publishButton({ ...base, justPublished: true }, 'header'), { label: 'Publicado!', disabled: false })
    assert.deepEqual(publishButton({ ...base, isLive: false }, 'header'), { label: 'Publicar site', disabled: false })
  })

  it('endereço reservado, publicando ou carregando desligam o botão', () => {
    assert.equal(publishButton({ ...base, dirty: true, reserved: true }, 'header').disabled, true)
    assert.equal(publishButton({ ...base, dirty: true, loading: true }, 'header').disabled, true)
    assert.deepEqual(publishButton({ ...base, dirty: true, publishing: true }, 'header'), { label: 'Publicando…', disabled: true })
  })

  it('celular: uma palavra só, e "Publicado" desligado quando não há o que publicar', () => {
    assert.deepEqual(publishButton(base, 'compact'), { label: 'Publicado', disabled: true })
    assert.deepEqual(publishButton({ ...base, dirty: true }, 'compact'), { label: 'Publicar', disabled: false })
    assert.deepEqual(publishButton({ ...base, isLive: false }, 'compact'), { label: 'Publicar', disabled: false })
    assert.deepEqual(publishButton({ ...base, dirty: true, publishing: true }, 'compact'), { label: 'Publicando…', disabled: true })
  })

  it('pontinho de pendente: site fora do ar ou com alterações, nunca enquanto publica', () => {
    assert.equal(hasPendingPublish(base), false)
    assert.equal(hasPendingPublish({ ...base, dirty: true }), true)
    assert.equal(hasPendingPublish({ ...base, isLive: false }), true)
    assert.equal(hasPendingPublish({ ...base, dirty: true, publishing: true }), false)
  })
})

describe('listas do site', () => {
  it('atualiza e remove por id sem mexer nos outros', () => {
    const list = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]
    assert.deepEqual(patchById(list, 'b', { name: 'X' }), [list[0], { id: 'b', name: 'X' }])
    assert.deepEqual(removeById(list, 'a'), [list[1]])
  })

  it('plano e produto novos nascem vazios e visíveis', () => {
    assert.deepEqual(blankPlan('p1'), { id: 'p1', name: '', description: '', price: 0, includes: [], isNew: true, visible: true })
    assert.equal(blankShowcaseItem('v1').visible, true)
    assert.equal(blankShowcaseItem('v1').photoId, null)
  })
})

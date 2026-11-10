import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SEGMENTS } from '../../lib/segments'
import { businessAreas, missingSuggestions } from './suggestions'

const ids = (list: { id: string }[]) => list.map((s) => s.id)
const seg = (id: string) => SEGMENTS.find((s) => s.id === id)!

describe('sugestões de serviços no Meu site', () => {
  it('sem serviços, nenhuma área é deduzida', () => {
    assert.deepEqual(businessAreas([]), [])
  })

  it('a área vem do nome de um serviço pronto, sem ligar para acento e maiúscula', () => {
    assert.deepEqual(ids(businessAreas([{ name: 'CORTE MASCULINO', category: 'Cabelo' }])), ['barbearia'])
    assert.deepEqual(ids(businessAreas([{ name: 'esmaltacao em gel', category: 'Unhas' }])), ['unhas'])
  })

  it('serviço próprio numa categoria usada puxa a primeira área dela', () => {
    assert.deepEqual(ids(businessAreas([{ name: 'Corte bordado', category: 'Cabelo' }])), ['cabelo'])
  })

  it('várias áreas ficam na ordem da lista', () => {
    const areas = businessAreas([
      { name: 'Fio a fio', category: 'Cílios' },
      { name: 'Manicure', category: 'Unhas' },
    ])
    assert.deepEqual(ids(areas), ['unhas', 'cilios'])
  })

  it('as sugestões deixam de fora o que já está cadastrado', () => {
    const left = missingSuggestions(seg('unhas'), [{ name: 'Manicure', category: 'Unhas' }])
    assert.ok(!left.some((s) => s.name === 'Manicure'))
    assert.equal(left.length, seg('unhas').services.length - 1)
  })

  it('cada área tem pelo menos 8 serviços prontos, sem nome repetido', () => {
    for (const s of SEGMENTS) {
      assert.ok(s.services.length >= 8, s.id)
      assert.equal(new Set(s.services.map((x) => x.name)).size, s.services.length, s.id)
    }
  })
})

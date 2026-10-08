import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decodePhoto, parsePhotoId, photoPath } from './photo.js'

const ID = '351b4862-88ae-4ba3-9daa-8e39ef498b04'

describe('parsePhotoId', () => {
  it('aceita só uuid', () => {
    assert.equal(parsePhotoId(new URL(`https://x.test/api/photo?id=${ID}`)), ID)
    assert.equal(parsePhotoId(new URL(`https://x.test/api/photo?id=${ID.toUpperCase()}`)), ID)
    assert.equal(parsePhotoId(new URL('https://x.test/api/photo?id=1;drop table')), null)
    assert.equal(parsePhotoId(new URL('https://x.test/api/photo')), null)
  })
})

describe('decodePhoto', () => {
  it('decodifica png, jpeg e webp', () => {
    const png = decodePhoto('data:image/png;base64,iVBORw0KGgo=')
    assert.equal(png?.type, 'image/png')
    assert.deepEqual([...(png?.bytes ?? [])].slice(0, 4), [0x89, 0x50, 0x4e, 0x47])
    assert.equal(decodePhoto('data:image/jpeg;base64,/9j/4AAQ')?.type, 'image/jpeg')
    assert.equal(decodePhoto('data:image/webp;base64,UklGRg==')?.type, 'image/webp')
  })

  it('recusa svg, outros tipos, texto solto e vazio', () => {
    assert.equal(decodePhoto('data:image/svg+xml;base64,AAAA'), null)
    assert.equal(decodePhoto('data:text/html;base64,PHNjcmlwdD4='), null)
    assert.equal(decodePhoto('javascript:alert(1)'), null)
    assert.equal(decodePhoto(''), null)
    assert.equal(decodePhoto(null), null)
  })
})

describe('photoPath', () => {
  it('monta o caminho público', () => {
    assert.equal(photoPath(ID), `/api/photo?id=${ID}`)
  })
})

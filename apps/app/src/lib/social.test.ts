import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { instagramHandle, instagramUrl } from './social.js'

describe('instagramHandle', () => {
  it('entende o perfil de qualquer jeito que a pessoa cole', () => {
    for (const raw of [
      '@studio.maria',
      'studio.maria',
      '  @studio.maria  ',
      'instagram.com/studio.maria',
      'www.instagram.com/studio.maria',
      'https://instagram.com/studio.maria',
      'https://www.instagram.com/studio.maria/',
      'http://www.instagram.com/studio.maria?hl=pt-br',
      'HTTPS://WWW.INSTAGRAM.COM/studio.maria#top',
      'm.instagram.com/studio.maria',
      'instagr.am/studio.maria',
      'https://www.instagram.com/_u/studio.maria',
      '//www.instagram.com/studio.maria',
    ]) {
      assert.equal(instagramHandle(raw), 'studio.maria', raw)
    }
  })

  it('o que não é perfil vira null (nunca um link quebrado)', () => {
    for (const raw of ['', '   ', null, undefined, 'www.instagram.com', 'https://www.instagram.com/', 'instagram.com', '"><script>', 'a b', 'x'.repeat(31), 'https://facebook.com/maria/x y']) {
      assert.equal(instagramHandle(raw), null, String(raw))
    }
  })
})

describe('instagramUrl', () => {
  it('abre o perfil com https e www', () => {
    assert.equal(instagramUrl('studio.maria'), 'https://www.instagram.com/studio.maria/')
  })
})

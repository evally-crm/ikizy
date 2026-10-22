import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HttpError } from './billing.js'
import { assertCanRead, cleanupPhotos, findOrphans, parsePhotoPath, parseUpload, uploadPhoto, type BlobStore, type Image, type PhotoStoreDb } from './photoStore.js'

const SALON = '33333333-3333-4333-8333-333333333333'
const OTHER = '44444444-4444-4444-8444-444444444444'
const PHOTO_ID = '55555555-5555-4555-8555-555555555555'
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const JPG = 'data:image/jpeg;base64,/9j/4AAQ'

const status = async (fn: () => unknown) => {
  try {
    await fn()
  } catch (e) {
    return e instanceof HttpError ? e.status : 'outro'
  }
  return 'ok'
}

function fakes(opts: { canUpload?: boolean; member?: boolean; referenced?: string[] } = {}) {
  const puts: string[] = []
  const deleted: string[] = []
  const db: PhotoStoreDb = {
    canUpload: async () => opts.canUpload ?? true,
    isMember: async (_u, salonId) => (opts.member ?? true) && salonId === SALON,
    referencedPaths: async () => new Set(opts.referenced ?? []),
  }
  const store: BlobStore & { blobs: { pathname: string; uploadedAt: Date }[] } = {
    blobs: [],
    put: async (path: string, _image: Image) => void puts.push(path),
    list: async () => store.blobs,
    del: async (paths) => void deleted.push(...paths),
  }
  return { db, store, puts, deleted }
}

describe('parseUpload', () => {
  it('foto do site: só a imagem; foto de cliente: imagem e miniatura', () => {
    const site = parseUpload({ salonId: SALON, scope: 'site', image: PNG })
    assert.equal(site.image.ext, 'png')
    assert.equal(site.thumb, null)
    const client = parseUpload({ salonId: SALON, scope: 'client', image: JPG, thumb: JPG })
    assert.equal(client.image.ext, 'jpg')
    assert.equal(client.thumb?.type, 'image/jpeg')
  })

  it('recusa o que não é imagem, imagem grande demais, negócio inválido e cliente sem miniatura', async () => {
    assert.equal(await status(() => parseUpload({ salonId: SALON, scope: 'site', image: 'data:text/html;base64,PGI+' })), 400)
    assert.equal(await status(() => parseUpload({ salonId: SALON, scope: 'site', image: `data:image/png;base64,${'A'.repeat(300_001)}` })), 400)
    assert.equal(await status(() => parseUpload({ salonId: 'x', scope: 'site', image: PNG })), 400)
    assert.equal(await status(() => parseUpload({ salonId: SALON, scope: 'outra', image: PNG })), 400)
    assert.equal(await status(() => parseUpload({ salonId: SALON, scope: 'client', image: JPG })), 400)
  })
})

describe('uploadPhoto', () => {
  it('grava nos caminhos do negócio e devolve os dois caminhos', async () => {
    const { db, store, puts } = fakes()
    const input = parseUpload({ salonId: SALON, scope: 'client', image: JPG, thumb: JPG })
    const r = await uploadPhoto({ db, store, newId: () => PHOTO_ID }, 'user', input)
    assert.equal(r.path, `salons/${SALON}/client/${PHOTO_ID}.jpg`)
    assert.equal(r.thumbPath, `salons/${SALON}/client/${PHOTO_ID}-mini.jpg`)
    assert.deepEqual(puts, [r.path, r.thumbPath])
  })

  it('sem permissão, não grava nada', async () => {
    const { db, store, puts } = fakes({ canUpload: false })
    const input = parseUpload({ salonId: SALON, scope: 'site', image: PNG })
    assert.equal(await status(() => uploadPhoto({ db, store }, 'user', input)), 403)
    assert.equal(puts.length, 0)
  })
})

describe('caminhos e leitura', () => {
  it('reconhece só caminhos da loja', () => {
    assert.deepEqual(parsePhotoPath(`salons/${SALON}/site/${PHOTO_ID}.webp`), { salonId: SALON, scope: 'site' })
    assert.equal(parsePhotoPath(`salons/${SALON}/../${PHOTO_ID}.png`), null)
    assert.equal(parsePhotoPath(`outra/${PHOTO_ID}.png`), null)
  })

  it('só a equipe do negócio dono do caminho lê o arquivo', async () => {
    const { db } = fakes()
    assert.equal(await assertCanRead(db, 'user', `salons/${SALON}/client/${PHOTO_ID}.jpg`), `salons/${SALON}/client/${PHOTO_ID}.jpg`)
    assert.equal(await status(() => assertCanRead(db, 'user', `salons/${OTHER}/client/${PHOTO_ID}.jpg`)), 404)
    assert.equal(await status(() => assertCanRead(db, 'user', 'qualquer-coisa')), 404)
  })
})

describe('limpeza', () => {
  const NOW = new Date('2026-11-01T12:00:00Z')
  const old = new Date('2026-10-30T12:00:00Z')
  const fresh = new Date('2026-11-01T11:00:00Z')
  const p = (n: number) => `salons/${SALON}/site/${String(n).padStart(8, '0')}-5555-4555-8555-555555555555.png`

  it('apaga só arquivo velho que o banco não usa', () => {
    const blobs = [
      { pathname: p(1), uploadedAt: old },
      { pathname: p(2), uploadedAt: old },
      { pathname: p(3), uploadedAt: fresh },
      { pathname: 'outra-coisa.txt', uploadedAt: old },
    ]
    assert.deepEqual(findOrphans(blobs, new Set([p(2)]), NOW), [p(1)])
  })

  it('não apaga quase tudo de uma vez (leitura do banco errada)', async () => {
    const { db, store, deleted } = fakes({ referenced: [] })
    store.blobs = Array.from({ length: 30 }, (_, i) => ({ pathname: p(i), uploadedAt: old }))
    const original = console.error
    console.error = () => {}
    const r = await cleanupPhotos({ db, store, now: NOW }).finally(() => {
      console.error = original
    })
    assert.equal(r.skipped, true)
    assert.equal(deleted.length, 0)
  })
})

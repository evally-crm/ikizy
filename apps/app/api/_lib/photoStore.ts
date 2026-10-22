import { HttpError } from './billing.js'

/**
 * fotos na loja privada do Vercel Blob (especificação 5.7). Caminhos:
 *   salons/<negócio>/site/<id>.<ext>            fotos do site, logo e capa
 *   salons/<negócio>/client/<id>.<ext>          antes e depois (foto inteira)
 *   salons/<negócio>/client/<id>-mini.<ext>     miniatura da lista
 * O banco guarda só o caminho; o servidor é quem grava e quem entrega.
 */

export type PhotoScope = 'site' | 'client'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/
const PATH = /^salons\/([0-9a-f-]{36})\/(site|client)\/([0-9a-f-]{36})(-mini)?\.(jpg|png|webp)$/

const EXT: Record<string, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' }

/** tamanho máximo do texto base64 (o app já reduz antes; é o mesmo teto que o banco tinha) */
export const MAX_CHARS = { site: 300_000, client: 400_000, thumb: 60_000 } as const

export interface Image {
  type: string
  ext: string
  bytes: Uint8Array
}

const bad = (message: string) => new HttpError(400, 'invalid_input', message)

/** data URL -> bytes; recusa o que não for imagem png/jpeg/webp ou passar do tamanho */
export function decodeImage(value: unknown, maxChars: number): Image {
  const m = typeof value === 'string' && value.length <= maxChars ? DATA_URL.exec(value) : null
  if (!m) throw bad('Foto inválida ou grande demais. Tente com outra imagem.')
  return { type: `image/${m[1]}`, ext: EXT[m[1]], bytes: new Uint8Array(Buffer.from(m[2], 'base64')) }
}

export interface UploadInput {
  salonId: string
  scope: PhotoScope
  image: Image
  /** só nas fotos de cliente */
  thumb: Image | null
}

export function parseUpload(body: unknown): UploadInput {
  if (!body || typeof body !== 'object') throw bad('Pedido inválido.')
  const b = body as Record<string, unknown>
  const salonId = typeof b.salonId === 'string' ? b.salonId.toLowerCase() : ''
  if (!UUID.test(salonId)) throw bad('Negócio inválido.')
  if (b.scope !== 'site' && b.scope !== 'client') throw bad('Tipo de foto inválido.')
  const scope = b.scope
  const image = decodeImage(b.image, MAX_CHARS[scope])
  const thumb = scope === 'client' ? decodeImage(b.thumb, MAX_CHARS.thumb) : null
  return { salonId, scope, image, thumb }
}

export const photoPath = (salonId: string, scope: PhotoScope, id: string, ext: string, mini = false) =>
  `salons/${salonId}/${scope}/${id}${mini ? '-mini' : ''}.${ext}`

/** de quem é o caminho; null se não for um caminho da loja */
export function parsePhotoPath(value: unknown): { salonId: string; scope: PhotoScope } | null {
  const m = typeof value === 'string' ? PATH.exec(value) : null
  return m ? { salonId: m[1], scope: m[2] as PhotoScope } : null
}

export interface PhotoStoreDb {
  /** site: dona ou gerente; cliente: qualquer pessoa da equipe. Em ambos, com assinatura ativa */
  canUpload(userId: string, salonId: string, scope: PhotoScope): Promise<boolean>
  /** faz parte da equipe do negócio (para ver as fotos dele) */
  isMember(userId: string, salonId: string): Promise<boolean>
  /** todos os caminhos que o banco ainda usa */
  referencedPaths(): Promise<Set<string>>
}

export interface BlobStore {
  put(path: string, image: Image): Promise<void>
  list(): Promise<{ pathname: string; uploadedAt: Date }[]>
  del(paths: string[]): Promise<void>
}

/** grava a foto (e a miniatura) e devolve os caminhos para o app guardar no banco */
export async function uploadPhoto(
  deps: { db: PhotoStoreDb; store: BlobStore; newId?: () => string },
  userId: string,
  input: UploadInput,
): Promise<{ path: string; thumbPath: string | null }> {
  if (!(await deps.db.canUpload(userId, input.salonId, input.scope))) {
    throw new HttpError(403, 'forbidden', input.scope === 'site' ? 'Só quem é dona ou gerente pode trocar as fotos do site.' : 'Sem permissão para guardar fotos neste negócio.')
  }
  const id = (deps.newId ?? (() => crypto.randomUUID()))()
  const path = photoPath(input.salonId, input.scope, id, input.image.ext)
  const thumbPath = input.thumb ? photoPath(input.salonId, input.scope, id, input.thumb.ext, true) : null
  await deps.store.put(path, input.image)
  if (thumbPath && input.thumb) await deps.store.put(thumbPath, input.thumb)
  return { path, thumbPath }
}

/** só quem é da equipe do negócio dono do caminho pode ver o arquivo */
export async function assertCanRead(db: PhotoStoreDb, userId: string, path: unknown): Promise<string> {
  const owner = parsePhotoPath(path)
  if (!owner) throw new HttpError(404, 'not_found', 'Foto não encontrada.')
  if (!(await db.isMember(userId, owner.salonId))) throw new HttpError(404, 'not_found', 'Foto não encontrada.')
  return path as string
}

/** arquivo sem linha no banco há mais de um dia (a linha é gravada logo depois do upload) */
export const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000

export function findOrphans(blobs: { pathname: string; uploadedAt: Date }[], referenced: Set<string>, now = new Date()): string[] {
  return blobs.filter((b) => parsePhotoPath(b.pathname) && !referenced.has(b.pathname) && now.getTime() - b.uploadedAt.getTime() > ORPHAN_AGE_MS).map((b) => b.pathname)
}

/** apaga da loja as fotos trocadas, removidas ou de negócios/clientes apagados */
export async function cleanupPhotos(deps: { db: PhotoStoreDb; store: BlobStore; now?: Date }): Promise<{ checked: number; deleted: number; skipped: boolean }> {
  const [blobs, referenced] = await Promise.all([deps.store.list(), deps.db.referencedPaths()])
  const orphans = findOrphans(blobs, referenced, deps.now)
  // trava: se a leitura do banco vier errada, apagaria tudo. Mais da metade de uma vez = não apaga e avisa no log
  if (orphans.length > 20 && orphans.length > blobs.length / 2) {
    console.error('limpeza de fotos suspensa: apagaria', orphans.length, 'de', blobs.length)
    return { checked: blobs.length, deleted: 0, skipped: true }
  }
  for (let i = 0; i < orphans.length; i += 100) await deps.store.del(orphans.slice(i, i + 100))
  return { checked: blobs.length, deleted: orphans.length, skipped: false }
}

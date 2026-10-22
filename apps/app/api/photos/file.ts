import { assertCanRead } from '../_lib/photoStore.js'
import { authenticate, createPhotoStoreDb, fail, readBlob } from '../_lib/runtime.js'

/**
 * GET /api/photos/file?path=salons/<negócio>/... (com o token no cabeçalho) -> a imagem.
 * Só para quem é da equipe do negócio. Fotos de clientes são dado sensível: sem cache no CDN, só no navegador.
 */
export async function GET(request: Request) {
  try {
    const user = await authenticate(request)
    const path = await assertCanRead(createPhotoStoreDb(), user.id, new URL(request.url).searchParams.get('path'))
    const result = await readBlob(path, request.headers.get('if-none-match') ?? undefined)
    if (!result) return new Response('Foto não encontrada', { status: 404, headers: { 'cache-control': 'no-store' } })
    const headers = { ETag: result.blob.etag, 'cache-control': 'private, no-cache', 'x-content-type-options': 'nosniff' }
    if (result.statusCode === 304) return new Response(null, { status: 304, headers })
    return new Response(result.stream, { headers: { ...headers, 'content-type': result.blob.contentType } })
  } catch (error) {
    return fail(error)
  }
}

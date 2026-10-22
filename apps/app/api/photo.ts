import { reportError } from './_lib/monitoring.js'
import { decodePhoto, parsePhotoId } from './_lib/photo.js'
import { parsePhotoPath } from './_lib/photoStore.js'
import { fetchPublicPhoto, readBlob } from './_lib/runtime.js'

const notFound = () => new Response('Foto não encontrada', { status: 404, headers: { 'cache-control': 'public, max-age=60' } })

// o id muda quando a foto muda, então o navegador e o CDN podem guardar para sempre
const FOREVER = { 'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable', 'x-content-type-options': 'nosniff' }

/** GET /api/photo?id=uuid -> imagem de um negócio publicado (usada pela página pública) */
export async function GET(request: Request) {
  const id = parsePhotoId(new URL(request.url))
  if (!id) return notFound()
  try {
    const stored = await fetchPublicPhoto(id)
    // foto na loja: o banco devolve "blob:<caminho>" (só de negócio publicado, como antes)
    if (stored?.startsWith('blob:')) {
      const path = stored.slice(5)
      if (!parsePhotoPath(path)) return notFound()
      const result = await readBlob(path)
      if (!result || result.statusCode !== 200) return notFound()
      return new Response(result.stream, { headers: { ...FOREVER, 'content-type': result.blob.contentType } })
    }
    const photo = decodePhoto(stored)
    if (!photo) return notFound()
    return new Response(photo.bytes, { headers: { ...FOREVER, 'content-type': photo.type } })
  } catch (error) {
    reportError(error, 'photo')
    return new Response('Erro ao carregar a foto', { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}

import { decodePhoto, parsePhotoId } from './_lib/photo.js'
import { fetchPublicPhoto } from './_lib/runtime.js'

const notFound = () => new Response('Foto não encontrada', { status: 404, headers: { 'cache-control': 'public, max-age=60' } })

/** GET /api/photo?id=uuid -> imagem de um negócio publicado (usada pela página pública) */
export async function GET(request: Request) {
  const id = parsePhotoId(new URL(request.url))
  if (!id) return notFound()
  try {
    const photo = decodePhoto(await fetchPublicPhoto(id))
    if (!photo) return notFound()
    return new Response(photo.bytes, {
      headers: {
        'content-type': photo.type,
        // o id muda quando a foto muda, então o navegador e o CDN podem guardar para sempre
        'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('photo', id, error)
    return new Response('Erro ao carregar a foto', { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}

import { parseUpload, uploadPhoto } from '../_lib/photoStore.js'
import { authenticate, blobStore, createPhotoStoreDb, fail, json } from '../_lib/runtime.js'

/**
 * POST { salonId, scope: 'site'|'client', image: dataURL, thumb?: dataURL } -> { path, thumbPath }
 * Grava a foto na loja privada depois de conferir o perfil; o app guarda o caminho no banco em seguida.
 */
export async function POST(request: Request) {
  try {
    const user = await authenticate(request)
    const input = parseUpload(await request.json().catch(() => null))
    const result = await uploadPhoto({ db: createPhotoStoreDb(), store: blobStore }, user.id, input)
    return json(result, 201)
  } catch (error) {
    return fail(error)
  }
}

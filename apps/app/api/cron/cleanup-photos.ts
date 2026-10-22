import { assertCronAuthorized } from '../_lib/cron.js'
import { cleanupPhotos } from '../_lib/photoStore.js'
import { blobStore, createPhotoStoreDb, fail, json } from '../_lib/runtime.js'

/** GET (cron diário da Vercel): apaga da loja as fotos que o banco não usa mais (trocadas, removidas, clientes apagadas) */
export async function GET(request: Request) {
  try {
    assertCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)
    return json(await cleanupPhotos({ db: createPhotoStoreDb(), store: blobStore }))
  } catch (error) {
    return fail(error)
  }
}

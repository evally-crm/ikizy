import { assertCronAuthorized, runExpireRequests } from '../_lib/cron.js'
import { createCronDb, fail, json } from '../_lib/runtime.js'

/** GET (cron diário da Vercel): pedidos do site sem resposta depois do horário viram cancelados (R-59) */
export async function GET(request: Request) {
  try {
    assertCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)
    return json(await runExpireRequests(createCronDb()))
  } catch (error) {
    return fail(error)
  }
}

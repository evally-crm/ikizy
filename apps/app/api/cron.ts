import { HttpError, reconcileStripe } from './_lib/billing.js'
import { assertCronAuthorized, runExpireRequests } from './_lib/cron.js'
import { cleanupPhotos } from './_lib/photoStore.js'
import { runReminders } from './_lib/reminders.js'
import {
  appUrl,
  blobStore,
  createCronDb,
  createPhotoStoreDb,
  createReconcileDb,
  createReminderDb,
  fail,
  json,
  sendEmail,
  stripe,
} from './_lib/runtime.js'

// uma função só para todas as tarefas (o plano Hobby da Vercel aceita 12 funções por deploy);
// /api/cron/<tarefa> chega aqui como /api/cron?job=<tarefa> (vercel.json)
const JOBS: Record<string, () => Promise<unknown>> = {
  /** 5h de Brasília: pedidos do site sem resposta depois do horário viram cancelados (R-59) */
  'expire-requests': () => runExpireRequests(createCronDb()),
  /** 9h de Brasília: avisos de teste, Pix ou cartão acabando e de acesso terminado (R-103) */
  'trial-reminders': () => runReminders({ db: createReminderDb(), send: sendEmail, link: `${appUrl()}/dashboard/assinatura` }),
  /** 3h de Brasília: confere assinaturas e Pix com o Stripe, caso algum webhook tenha se perdido */
  'reconcile-stripe': () => reconcileStripe({ db: createReconcileDb(), stripe: stripe() }),
  /** 4h de Brasília: apaga da loja as fotos que o banco não usa mais (trocadas, removidas, clientes apagadas) */
  'cleanup-photos': () => cleanupPhotos({ db: createPhotoStoreDb(), store: blobStore }),
}

/** GET /api/cron/<tarefa> (cron diário da Vercel) */
export async function GET(request: Request) {
  try {
    assertCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)
    const job = JOBS[new URL(request.url).searchParams.get('job') ?? '']
    if (!job) throw new HttpError(404, 'not_found', 'Tarefa não encontrada.')
    return json(await job())
  } catch (error) {
    return fail(error)
  }
}

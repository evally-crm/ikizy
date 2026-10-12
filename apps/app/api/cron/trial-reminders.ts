import { assertCronAuthorized } from '../_lib/cron.js'
import { runReminders } from '../_lib/reminders.js'
import { appUrl, createReminderDb, fail, json, sendEmail } from '../_lib/runtime.js'

/** GET (cron diário da Vercel, 9h de Brasília): avisos de teste, Pix ou cartão acabando e de acesso terminado (R-103) */
export async function GET(request: Request) {
  try {
    assertCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)
    const result = await runReminders({
      db: createReminderDb(),
      send: sendEmail,
      link: `${appUrl()}/dashboard/assinatura`,
    })
    return json(result)
  } catch (error) {
    return fail(error)
  }
}

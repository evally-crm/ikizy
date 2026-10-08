import { dispatch, sameSecret } from '../_lib/campaigns.js'
import { createCampaignDb, json, whatsappGateway } from '../_lib/runtime.js'

/**
 * envia as mensagens da fila que já chegaram na hora (uma por salão a cada chamada).
 * Chamado a cada minuto por um cron com `Authorization: Bearer CRON_SECRET`
 * (crontab no servidor da Evolution, ou Vercel Cron no plano Pro).
 */
async function run(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!sameSecret(token, process.env.CRON_SECRET ?? '')) return json({ error: 'forbidden' }, 403)
  try {
    return json(await dispatch({ db: createCampaignDb(), gateway: whatsappGateway(), webhookUrl: '' }))
  } catch (error) {
    console.error('dispatch', error)
    return json({ error: 'dispatch_failed' }, 500)
  }
}

export const GET = run
export const POST = run

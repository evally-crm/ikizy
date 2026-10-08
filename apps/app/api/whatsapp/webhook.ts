import { handleEvolutionEvent, sameSecret } from '../_lib/campaigns.js'
import { createCampaignDb, json } from '../_lib/runtime.js'

/** eventos da Evolution API: WhatsApp conectou/caiu e respostas das clientes (SAIR) */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!sameSecret(token, process.env.EVOLUTION_WEBHOOK_SECRET ?? '')) return json({ error: 'forbidden' }, 403)

  const payload = await request.json().catch(() => null)
  try {
    const result = await handleEvolutionEvent(createCampaignDb(), payload)
    return json({ received: true, result })
  } catch (error) {
    // 500 faz a Evolution tentar de novo
    console.error('evolution webhook', error)
    return json({ error: 'handler_failed' }, 500)
  }
}

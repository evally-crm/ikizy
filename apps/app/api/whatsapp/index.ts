import { HttpError } from '../_lib/billing.js'
import { cancelCampaign, connectWhatsapp, createCampaign, disconnectWhatsapp, getOverview, parseCampaignInput } from '../_lib/campaigns.js'
import { authenticate, createCampaignDb, fail, json, whatsappGateway, whatsappWebhookUrl } from '../_lib/runtime.js'

const deps = () => ({ db: createCampaignDb(), gateway: whatsappGateway(), webhookUrl: whatsappWebhookUrl() })

/** GET -> WhatsApp do salão, campanhas do mês, limite e clientes que não podem receber agora */
export async function GET(request: Request) {
  try {
    const user = await authenticate(request)
    return json(await getOverview(deps(), user))
  } catch (error) {
    return fail(error)
  }
}

/**
 * POST { action: 'connect' } -> { state, qr }        conecta o WhatsApp do salão (QR code)
 * POST { action: 'disconnect' }                      desconecta e pausa as campanhas
 * POST { action: 'create', template, fields, clientIds } -> { id, total, usedCredit }
 * POST { action: 'cancel', id } -> { refunded }
 */
export async function POST(request: Request) {
  try {
    const user = await authenticate(request)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    switch (body?.action) {
      case 'connect':
        return json(await connectWhatsapp(deps(), user))
      case 'disconnect':
        return json(await disconnectWhatsapp(deps(), user))
      case 'create':
        return json(await createCampaign(deps(), user, parseCampaignInput(body)), 201)
      case 'cancel':
        return json(await cancelCampaign(deps(), user, body.id))
      default:
        throw new HttpError(400, 'invalid_action', 'Ação inválida.')
    }
  } catch (error) {
    return fail(error)
  }
}

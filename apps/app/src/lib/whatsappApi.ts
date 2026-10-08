import { neon } from './neon'
import type { CampaignQuota, ExtraPack, OfferFields, TemplateId } from './campaigns'

export type WhatsappState = 'open' | 'connecting' | 'close'
export type CampaignStatus = 'sending' | 'paused' | 'done' | 'canceled'

export interface CampaignSummary {
  id: string
  template: TemplateId
  preview: string
  status: CampaignStatus
  usedCredit: boolean
  total: number
  sent: number
  failed: number
  createdAt: string
}

export interface Overview {
  /** a Evolution API está configurada no servidor */
  available: boolean
  whatsapp: { state: WhatsappState; phone: string | null }
  quota: CampaignQuota & { free: number }
  campaigns: CampaignSummary[]
  exclusions: { optedOut: string[]; receivedThisMonth: string[] }
  /** só a dona compra campanhas extras */
  canBuy: boolean
}

/** erro das funções do WhatsApp, com um código estável para a tela decidir o que fazer */
export class WhatsappError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const { data } = (await neon?.auth.getSession()) ?? { data: { session: null } }
  const token = data.session?.access_token
  if (!token) throw new WhatsappError('unauthenticated', 'Entre na sua conta para continuar.')

  let res: Response
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new WhatsappError('network', 'Sem conexão. Verifique sua internet e tente de novo.')
  }
  const payload = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
  if (!res.ok || !payload) {
    // no ambiente local as funções de servidor não existem (/api devolve a própria página)
    if (res.status === 404 || res.status === 405 || !payload) {
      throw new WhatsappError('unavailable', 'As campanhas não estão disponíveis neste ambiente.')
    }
    throw new WhatsappError(payload.error ?? 'error', payload.message ?? 'Não foi possível continuar agora. Tente novamente.')
  }
  return payload as T
}

export const fetchOverview = () => request<Overview>('/api/whatsapp')
export const connectWhatsapp = () => request<{ state: WhatsappState; qr: string | null }>('/api/whatsapp', { action: 'connect' })
export const disconnectWhatsapp = () => request<{ state: WhatsappState }>('/api/whatsapp', { action: 'disconnect' })
export const createCampaign = (template: TemplateId, fields: OfferFields, clientIds: string[]) =>
  request<{ id: string; total: number; usedCredit: boolean }>('/api/whatsapp', { action: 'create', template, fields, clientIds })
export const cancelCampaign = (id: string) => request<{ refunded: boolean }>('/api/whatsapp', { action: 'cancel', id })

/** abre o Checkout do Stripe para comprar campanhas extras (cartão ou Pix) */
export async function buyExtraCampaigns(quantity: ExtraPack): Promise<void> {
  const { url } = await request<{ url: string }>('/api/billing/checkout', { kind: 'campaign_credit', quantity })
  window.location.assign(url)
}

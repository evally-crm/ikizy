import {
  FREE_CAMPAIGNS_PER_MONTH,
  MAX_RECIPIENTS,
  MIN_RECIPIENTS,
  SEND_HOURS,
  isOptOut,
  isTemplateId,
  phoneVariants,
  renderOffer,
  toWhatsappNumber,
  validateOffer,
  type CampaignQuota,
  type OfferFields,
  type TemplateId,
} from '../../src/lib/campaigns.js'
import { HttpError, type Membership } from './billing.js'
import { GatewayError, type InstanceState, type WhatsappGateway } from './evolution.js'

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

export interface ClaimedMessage {
  id: string
  salonId: string
  instance: string
  phone: string
  body: string
}

export type CreateResult =
  | { ok: true; campaign_id: string; total: number; used_credit: boolean }
  | { ok: false; error: 'no_access' | 'not_connected' | 'too_many' | 'no_quota' | 'too_few'; eligible?: number }

/** tudo que as campanhas precisam do banco; a implementação real fica em runtime.ts */
export interface CampaignDb {
  getMembership(userId: string): Promise<Membership | null>
  getInstance(salonId: string): Promise<{ name: string; state: InstanceState; phone: string | null } | null>
  saveInstance(salonId: string, name: string, state: InstanceState, phone: string | null): Promise<void>
  findSalonByInstance(name: string): Promise<string | null>
  /** devolve o salão da instância (null se não é nossa) */
  setInstanceState(name: string, state: InstanceState, phone?: string | null): Promise<string | null>
  getSalon(salonId: string): Promise<{ name: string; siteUrl?: string }>
  getQuota(salonId: string): Promise<CampaignQuota>
  listCampaigns(salonId: string): Promise<CampaignSummary[]>
  /** clientes que não podem entrar numa campanha agora */
  exclusions(salonId: string): Promise<{ optedOut: string[]; receivedThisMonth: string[] }>
  getClients(salonId: string, ids: string[]): Promise<{ id: string; name: string; phone: string }[]>
  createCampaign(p: {
    salonId: string
    userId: string
    template: TemplateId
    fields: OfferFields
    preview: string
    messages: { client_id: string; phone: string; body: string }[]
  }): Promise<CreateResult>
  cancelCampaign(salonId: string, id: string): Promise<{ ok: boolean; error?: string; refunded?: boolean }>
  claim(limit: number): Promise<ClaimedMessage[]>
  finish(id: string, ok: boolean, error?: string): Promise<void>
  /** devolve para a fila (a VPS não respondeu) */
  requeue(id: string): Promise<void>
  pause(salonId: string, messageId?: string): Promise<void>
  resume(salonId: string): Promise<void>
  optOut(salonId: string, phones: string[]): Promise<number>
}

export interface CampaignDeps {
  db: CampaignDb
  /** null quando a Evolution não está configurada neste ambiente */
  gateway: WhatsappGateway | null
  webhookUrl: string
  now?: Date
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** nome da instância na Evolution: um por salão, estável */
export const instanceName = (salonId: string) => `ikizy_${salonId.replace(/-/g, '')}`

async function manager(db: CampaignDb, userId: string): Promise<Membership> {
  const member = await db.getMembership(userId)
  if (!member) throw new HttpError(404, 'no_salon', 'Você ainda não tem um negócio cadastrado.')
  if (member.role !== 'owner' && member.role !== 'manager') {
    throw new HttpError(403, 'not_manager', 'Só a dona ou a gerente do negócio pode fazer campanhas.')
  }
  return member
}

function needGateway(gateway: WhatsappGateway | null): WhatsappGateway {
  if (!gateway) throw new HttpError(503, 'whatsapp_unavailable', 'O envio pelo WhatsApp ainda não está disponível.')
  return gateway
}

// ---------------------------------------------------------------- estado da tela

export async function getOverview(deps: CampaignDeps, user: { id: string }) {
  const { db, gateway } = deps
  const member = await manager(db, user.id)
  let instance = await db.getInstance(member.salonId)

  // confere com a Evolution: o celular pode ter desconectado sem o webhook chegar
  if (instance && gateway) {
    const live = await gateway.state(instance.name).catch(() => null)
    if (live && (live.state !== instance.state || (live.phone && live.phone !== instance.phone))) {
      await db.saveInstance(member.salonId, instance.name, live.state, live.phone ?? instance.phone)
      if (live.state === 'open' && instance.state !== 'open') await db.resume(member.salonId)
      instance = { ...instance, state: live.state, phone: live.phone ?? instance.phone }
    }
  }

  const [quota, campaigns, exclusions] = await Promise.all([db.getQuota(member.salonId), db.listCampaigns(member.salonId), db.exclusions(member.salonId)])
  return {
    available: gateway !== null,
    whatsapp: instance ? { state: instance.state, phone: instance.phone } : { state: 'close' as const, phone: null },
    quota: { ...quota, free: FREE_CAMPAIGNS_PER_MONTH },
    campaigns,
    exclusions,
    canBuy: member.role === 'owner',
  }
}

// ---------------------------------------------------------------- conectar / desconectar

export async function connectWhatsapp(deps: CampaignDeps, user: { id: string }) {
  const { db } = deps
  const gateway = needGateway(deps.gateway)
  const member = await manager(db, user.id)
  const name = (await db.getInstance(member.salonId))?.name ?? instanceName(member.salonId)
  const { state, qr } = await gateway.connect(name, deps.webhookUrl).catch((e: unknown) => {
    throw new HttpError(502, 'whatsapp_error', e instanceof Error ? e.message : 'Não foi possível conectar agora.')
  })
  await db.saveInstance(member.salonId, name, state, null)
  if (state === 'open') await db.resume(member.salonId)
  return { state, qr }
}

export async function disconnectWhatsapp(deps: CampaignDeps, user: { id: string }) {
  const { db } = deps
  const gateway = needGateway(deps.gateway)
  const member = await manager(db, user.id)
  const instance = await db.getInstance(member.salonId)
  if (!instance) return { state: 'close' as const }
  await gateway.logout(instance.name).catch(() => undefined)
  await db.saveInstance(member.salonId, instance.name, 'close', null)
  await db.pause(member.salonId)
  return { state: 'close' as const }
}

// ---------------------------------------------------------------- criar / cancelar

export interface CampaignInput {
  template: TemplateId
  fields: Record<string, unknown>
  clientIds: string[]
}

export function parseCampaignInput(body: unknown): CampaignInput {
  const b = (body ?? {}) as Record<string, unknown>
  if (!isTemplateId(b.template)) throw new HttpError(400, 'invalid_template', 'Escolha um modelo de mensagem.')
  const fields = b.fields && typeof b.fields === 'object' ? (b.fields as Record<string, unknown>) : {}
  if (!Array.isArray(b.clientIds) || !b.clientIds.every((id) => typeof id === 'string' && UUID.test(id))) {
    throw new HttpError(400, 'invalid_clients', 'Lista de clientes inválida.')
  }
  const clientIds = [...new Set(b.clientIds as string[])]
  if (clientIds.length < MIN_RECIPIENTS) throw new HttpError(400, 'too_few', `Escolha pelo menos ${MIN_RECIPIENTS} clientes.`)
  if (clientIds.length > MAX_RECIPIENTS) throw new HttpError(400, 'too_many', `Escolha no máximo ${MAX_RECIPIENTS} clientes.`)
  return { template: b.template, fields, clientIds }
}

const CREATE_ERRORS: Record<Exclude<CreateResult, { ok: true }>['error'], [number, string]> = {
  no_access: [402, 'Sua assinatura do IKIZY não está ativa. Renove para enviar campanhas.'],
  not_connected: [409, 'Conecte o WhatsApp do salão antes de enviar.'],
  too_many: [400, `Escolha no máximo ${MAX_RECIPIENTS} clientes.`],
  no_quota: [402, 'Você já usou a campanha grátis deste mês. Compre uma campanha extra para enviar outra.'],
  too_few: [400, `Sobraram menos de ${MIN_RECIPIENTS} clientes que podem receber (quem já recebeu oferta este mês ou pediu para sair fica de fora).`],
}

export async function createCampaign(deps: CampaignDeps, user: { id: string }, input: CampaignInput) {
  const { db } = deps
  const member = await manager(db, user.id)
  const { fields, error } = validateOffer(input.template, input.fields)
  if (error) throw new HttpError(400, 'invalid_fields', error)

  const [salon, clients] = await Promise.all([db.getSalon(member.salonId), db.getClients(member.salonId, input.clientIds)])
  const messages = clients.flatMap((c) => {
    const phone = toWhatsappNumber(c.phone)
    if (!phone) return []
    return [{ client_id: c.id, phone, body: renderOffer(input.template, fields, { clientName: c.name, salonName: salon.name, siteUrl: salon.siteUrl }) }]
  })
  if (messages.length < MIN_RECIPIENTS) {
    throw new HttpError(400, 'too_few', `Só ${messages.length} das clientes escolhidas têm WhatsApp válido. O mínimo é ${MIN_RECIPIENTS}.`)
  }

  const preview = renderOffer(input.template, fields, { clientName: 'Maria', salonName: salon.name, siteUrl: salon.siteUrl })
  const result = await db.createCampaign({ salonId: member.salonId, userId: user.id, template: input.template, fields, preview, messages })
  if (!result.ok) {
    const [status, message] = CREATE_ERRORS[result.error]
    throw new HttpError(status, result.error, message)
  }
  return { id: result.campaign_id, total: result.total, usedCredit: result.used_credit }
}

export async function cancelCampaign(deps: CampaignDeps, user: { id: string }, id: unknown) {
  const member = await manager(deps.db, user.id)
  if (typeof id !== 'string' || !UUID.test(id)) throw new HttpError(400, 'invalid_campaign', 'Campanha inválida.')
  const r = await deps.db.cancelCampaign(member.salonId, id)
  if (!r.ok) throw new HttpError(r.error === 'not_found' ? 404 : 409, r.error ?? 'error', r.error === 'not_found' ? 'Campanha não encontrada.' : 'Esta campanha já terminou.')
  return { refunded: r.refunded === true }
}

// ---------------------------------------------------------------- envio (cron)

/** hora cheia em São Paulo (0–23) */
export function saoPauloHour(now: Date): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(now)
  return Number(h)
}

export const withinSendHours = (now: Date) => {
  const h = saoPauloHour(now)
  return h >= SEND_HOURS.from && h < SEND_HOURS.to
}

/** envia o que está na hora: no máximo uma mensagem por salão a cada chamada */
export async function dispatch(deps: CampaignDeps) {
  const now = deps.now ?? new Date()
  if (!deps.gateway) return { sent: 0, failed: 0, paused: 0, retried: 0, skipped: 'unavailable' as const }
  if (!withinSendHours(now)) return { sent: 0, failed: 0, paused: 0, retried: 0, skipped: 'hours' as const }
  const gateway = deps.gateway
  const batch = await deps.db.claim(25)
  const result = { sent: 0, failed: 0, paused: 0, retried: 0 }

  await Promise.all(
    batch.map(async (m) => {
      try {
        await gateway.sendText(m.instance, m.phone, m.body)
        await deps.db.finish(m.id, true)
        result.sent++
      } catch (e) {
        if (e instanceof GatewayError && e.kind === 'disconnected') {
          // a mensagem volta para a fila e a campanha espera o salão reconectar
          await deps.db.pause(m.salonId, m.id)
          await deps.db.setInstanceState(m.instance, 'close')
          result.paused++
        } else if (e instanceof GatewayError && e.kind === 'unreachable') {
          await deps.db.requeue(m.id)
          result.retried++
        } else {
          await deps.db.finish(m.id, false, e instanceof Error ? e.message : 'erro')
          result.failed++
        }
      }
    }),
  )
  return result
}

// ---------------------------------------------------------------- webhook da Evolution

/** número de quem escreveu; nas contas novas o WhatsApp manda um id "@lid" e o número vem num campo à parte */
function senderNumber(key: Record<string, unknown>): string | null {
  for (const v of [key.senderPn, key.remoteJidAlt, key.participantPn, key.remoteJid]) {
    if (typeof v === 'string' && v.endsWith('@s.whatsapp.net')) return v.split('@')[0].split(':')[0]
  }
  return null
}

function messageText(message: Record<string, unknown> | undefined): string {
  if (!message) return ''
  if (typeof message.conversation === 'string') return message.conversation
  const ext = message.extendedTextMessage as Record<string, unknown> | undefined
  return typeof ext?.text === 'string' ? ext.text : ''
}

export async function handleEvolutionEvent(db: CampaignDb, payload: unknown): Promise<string> {
  const p = (payload ?? {}) as Record<string, unknown>
  const event = String(p.event ?? '').toLowerCase().replace(/_/g, '.')
  const instance = typeof p.instance === 'string' ? p.instance : ''
  const data = (p.data ?? {}) as Record<string, unknown>
  if (!instance.startsWith('ikizy_')) return 'ignored'

  if (event === 'connection.update') {
    const state: InstanceState = data.state === 'open' || data.state === 'connecting' ? data.state : 'close'
    const phone = typeof data.wuid === 'string' ? data.wuid.split('@')[0].split(':')[0] : undefined
    const salonId = await db.setInstanceState(instance, state, phone)
    if (!salonId) return 'unknown_instance'
    if (state === 'open') await db.resume(salonId)
    if (state === 'close') await db.pause(salonId)
    return `state:${state}`
  }

  if (event === 'messages.upsert') {
    const items = Array.isArray(data) ? (data as Record<string, unknown>[]) : [data]
    let count = 0
    let salonId: string | null | undefined
    for (const item of items) {
      const key = (item.key ?? {}) as Record<string, unknown>
      if (key.fromMe === true) continue
      if (!isOptOut(messageText(item.message as Record<string, unknown> | undefined))) continue
      const number = senderNumber(key)
      if (!number) continue
      salonId ??= await db.findSalonByInstance(instance)
      if (!salonId) return 'unknown_instance'
      count += await db.optOut(salonId, phoneVariants(number))
    }
    return `opt_out:${count}`
  }
  return 'ignored'
}

/** confere o segredo do webhook sem vazar o tempo de comparação */
export function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}


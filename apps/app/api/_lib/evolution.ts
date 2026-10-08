/**
 * Cliente da Evolution API (v2), que mantém o WhatsApp de cada salão conectado num servidor próprio
 * (VPS). Cada salão é uma "instância" lá. Só o servidor fala com ela: a chave nunca vai para o navegador.
 */

export type InstanceState = 'open' | 'connecting' | 'close'

/** o que as regras de campanha precisam do WhatsApp; a implementação real fala com a Evolution por HTTP */
export interface WhatsappGateway {
  /** cria a instância (se ainda não existe) e devolve o QR code para conectar, quando houver */
  connect(instance: string, webhookUrl: string): Promise<{ state: InstanceState; qr: string | null }>
  /** estado atual; 'close' também quando a instância não existe na Evolution */
  state(instance: string): Promise<{ state: InstanceState; phone: string | null }>
  sendText(instance: string, number: string, text: string): Promise<void>
  logout(instance: string): Promise<void>
}

/**
 * falha ao enviar: `disconnected` pausa a campanha, `unreachable` (a VPS não respondeu) tenta de novo depois,
 * `invalid_number` e `other` só marcam aquela mensagem como não enviada
 */
export class GatewayError extends Error {
  kind: 'disconnected' | 'unreachable' | 'invalid_number' | 'other'
  constructor(kind: GatewayError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

const WEBHOOK_EVENTS = ['CONNECTION_UPDATE', 'MESSAGES_UPSERT']

const asState = (v: unknown): InstanceState => (v === 'open' || v === 'connecting' ? v : 'close')
const jidNumber = (jid: unknown) => (typeof jid === 'string' && jid.includes('@s.whatsapp.net') ? jid.split('@')[0].split(':')[0] : null)

export function createEvolutionGateway(opts: { url: string; apiKey: string; fetch?: typeof fetch }): WhatsappGateway {
  const base = opts.url.replace(/\/$/, '')
  const doFetch = opts.fetch ?? fetch

  async function call(method: string, path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> | unknown[] | null }> {
    let res: Response
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers: { apikey: opts.apiKey, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      throw new GatewayError('unreachable', 'WhatsApp fora do ar no momento.')
    }
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | unknown[] | null
    return { status: res.status, data }
  }

  const qrOf = (d: unknown): string | null => {
    const o = (d ?? {}) as Record<string, unknown>
    const nested = (o.qrcode ?? {}) as Record<string, unknown>
    const b64 = typeof o.base64 === 'string' ? o.base64 : typeof nested.base64 === 'string' ? nested.base64 : null
    return b64 && b64.startsWith('data:image/') ? b64 : null
  }

  async function state(instance: string) {
    const r = await call('GET', `/instance/connectionState/${encodeURIComponent(instance)}`)
    if (r.status === 404) return { state: 'close' as const, phone: null, missing: true }
    if (r.status >= 400) throw new GatewayError('other', 'Não foi possível consultar o WhatsApp.')
    const inst = ((r.data as Record<string, unknown>)?.instance ?? {}) as Record<string, unknown>
    const s = asState(inst.state)
    let phone: string | null = null
    if (s === 'open') {
      // o número conectado (opcional: versões antigas não devolvem)
      const f = await call('GET', `/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`).catch(() => null)
      const first = Array.isArray(f?.data) ? (f.data[0] as Record<string, unknown> | undefined) : undefined
      phone = jidNumber(first?.ownerJid) ?? jidNumber((first?.instance as Record<string, unknown> | undefined)?.owner)
    }
    return { state: s, phone, missing: false }
  }

  return {
    async connect(instance, webhookUrl) {
      const current = await state(instance)
      if (current.missing) {
        const created = await call('POST', '/instance/create', {
          instanceName: instance,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
          webhook: { url: webhookUrl, byEvents: false, base64: false, events: WEBHOOK_EVENTS },
        })
        if (created.status >= 400) throw new GatewayError('other', 'Não foi possível preparar o WhatsApp agora.')
        // algumas versões ignoram o webhook do create: grava de novo pelo endpoint próprio
        await call('POST', `/webhook/set/${encodeURIComponent(instance)}`, {
          webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, events: WEBHOOK_EVENTS },
        })
        const qr = qrOf(created.data)
        if (qr) return { state: 'connecting', qr }
      } else if (current.state === 'open') {
        return { state: 'open', qr: null }
      }
      const r = await call('GET', `/instance/connect/${encodeURIComponent(instance)}`)
      if (r.status >= 400) throw new GatewayError('other', 'Não foi possível gerar o QR code agora.')
      const inst = ((r.data as Record<string, unknown>)?.instance ?? {}) as Record<string, unknown>
      if (inst.state === 'open') return { state: 'open', qr: null }
      return { state: 'connecting', qr: qrOf(r.data) }
    },

    async state(instance) {
      const { state: s, phone } = await state(instance)
      return { state: s, phone }
    },

    async sendText(instance, number, text) {
      const r = await call('POST', `/message/sendText/${encodeURIComponent(instance)}`, { number, text, delay: 1200 })
      if (r.status < 400) return
      const raw = JSON.stringify(r.data ?? '').toLowerCase()
      if (raw.includes('"exists":false')) throw new GatewayError('invalid_number', 'Número sem WhatsApp.')
      // a Evolution não tem um código próprio para "desconectado": confere o estado
      const now = await state(instance).catch(() => null)
      if (!now || now.state !== 'open') throw new GatewayError('disconnected', 'WhatsApp desconectado.')
      throw new GatewayError('other', `Falha ao enviar (${r.status}).`)
    },

    async logout(instance) {
      await call('DELETE', `/instance/logout/${encodeURIComponent(instance)}`)
    },
  }
}

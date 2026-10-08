import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HttpError, type Membership } from './billing.js'
import {
  cancelCampaign,
  connectWhatsapp,
  createCampaign,
  dispatch,
  getOverview,
  handleEvolutionEvent,
  instanceName,
  parseCampaignInput,
  sameSecret,
  saoPauloHour,
  type CampaignDb,
  type ClaimedMessage,
  type CreateResult,
} from './campaigns.js'
import { GatewayError, createEvolutionGateway, type InstanceState, type WhatsappGateway } from './evolution.js'
import {
  OPT_OUT_LINE,
  campaignsLeft,
  isOptOut,
  phoneVariants,
  renderOffer,
  toWhatsappNumber,
  validateOffer,
} from '../../src/lib/campaigns.js'

const SALON = '11111111-1111-1111-1111-111111111111'
const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`)
const user = { id: 'user-1' }
// 15h em São Paulo (18h UTC)
const DAYTIME = new Date('2026-10-14T18:00:00Z')

async function rejects(p: Promise<unknown>, status: number, code?: string) {
  await assert.rejects(p, (e: unknown) => e instanceof HttpError && e.status === status && (!code || e.code === code))
}

// ---------------------------------------------------------------- fakes

function fakeDb(opts: { member?: Membership | null; create?: CreateResult; claimed?: ClaimedMessage[]; instance?: { state: InstanceState } | null } = {}) {
  const member = opts.member === undefined ? { salonId: SALON, salonName: 'Studio Teste', role: 'owner' } : opts.member
  const calls = {
    created: [] as Parameters<CampaignDb['createCampaign']>[0][],
    saved: [] as [string, InstanceState][],
    finished: [] as [string, boolean, string | undefined][],
    requeued: [] as string[],
    paused: [] as [string, string | undefined][],
    resumed: [] as string[],
    optOut: [] as string[][],
    states: [] as [string, InstanceState][],
  }
  let instance = opts.instance === null ? null : { name: instanceName(SALON), state: opts.instance?.state ?? ('open' as InstanceState), phone: null as string | null }
  const db: CampaignDb = {
    getMembership: async () => member,
    getInstance: async () => instance,
    saveInstance: async (_s, name, state, phone) => {
      calls.saved.push([name, state])
      instance = { name, state, phone }
    },
    findSalonByInstance: async (name) => (name === instanceName(SALON) ? SALON : null),
    setInstanceState: async (name, state) => {
      calls.states.push([name, state])
      return name === instanceName(SALON) ? SALON : null
    },
    getSalon: async () => ({ name: 'Studio Teste', siteUrl: 'https://studio.ikizy.com' }),
    getQuota: async () => ({ usedFree: 0, credits: 2 }),
    listCampaigns: async () => [],
    exclusions: async () => ({ optedOut: [], receivedThisMonth: [] }),
    // a última cliente está sem telefone válido
    getClients: async (_s, list) => list.map((id, i) => ({ id, name: `Cliente ${i + 1} Silva`, phone: i === list.length - 1 ? '123' : `(11) 9${String(i).padStart(8, '0')}` })),
    createCampaign: async (p) => {
      calls.created.push(p)
      return opts.create ?? { ok: true, campaign_id: 'camp-1', total: p.messages.length, used_credit: false }
    },
    cancelCampaign: async (_s, id) => (id === ids(1)[0] ? { ok: true, refunded: true } : { ok: false, error: 'not_found' }),
    claim: async () => opts.claimed ?? [],
    finish: async (id, ok, error) => void calls.finished.push([id, ok, error]),
    requeue: async (id) => void calls.requeued.push(id),
    pause: async (salonId, messageId) => void calls.paused.push([salonId, messageId]),
    resume: async (salonId) => void calls.resumed.push(salonId),
    optOut: async (_s, phones) => {
      calls.optOut.push(phones)
      return 1
    },
  }
  return { db, calls }
}

function fakeGateway(over: Partial<WhatsappGateway> = {}) {
  const sent: [string, string, string][] = []
  const gateway: WhatsappGateway = {
    connect: async () => ({ state: 'connecting', qr: 'data:image/png;base64,AAA' }),
    state: async () => ({ state: 'open', phone: '5511999990000' }),
    sendText: async (instance, number, text) => void sent.push([instance, number, text]),
    logout: async () => undefined,
    ...over,
  }
  return { gateway, sent }
}

const deps = (db: CampaignDb, gateway: WhatsappGateway | null = fakeGateway().gateway, now = DAYTIME) => ({ db, gateway, webhookUrl: 'https://app.test/api/whatsapp/webhook?token=x', now })

// ---------------------------------------------------------------- modelos e telefone

describe('modelos de oferta', () => {
  it('confere campos obrigatórios e formatos', () => {
    assert.equal(validateOffer('promocao', { servico: 'Gel', preco: '89,9', validade: '2026-10-31' }).error, null)
    assert.match(validateOffer('promocao', { servico: 'Gel', validade: '2026-10-31' }).error ?? '', /Preço/)
    assert.match(validateOffer('promocao', { servico: 'Gel', preco: 'grátis', validade: '2026-10-31' }).error ?? '', /Preço inválido/)
    assert.match(validateOffer('desconto', { servico: 'Gel', desconto: '3', validade: '2026-10-31' }).error ?? '', /Desconto/)
    assert.equal(validateOffer('novidade', { servico: 'Lash lifting' }).error, null)
  })

  it('limpa quebras de linha e ignora campos que o modelo não usa', () => {
    const { fields } = validateOffer('novidade', { servico: ' Lash\n\nlifting  ', validade: '2026-10-31', extra: 'a'.repeat(500) })
    assert.equal(fields.servico, 'Lash lifting')
    assert.equal(fields.validade, undefined)
    assert.equal(fields.extra?.length, 160)
  })

  it('texto com primeiro nome, preço em reais, data por extenso, link e opção de sair', () => {
    const text = renderOffer('promocao', { servico: 'Esmaltação em gel', preco: '89,9', validade: '2026-10-31' }, { clientName: 'Marina Costa', salonName: 'Studio X', siteUrl: 'https://x.ikizy.com' })
    assert.match(text, /^Oi, Marina!/)
    assert.match(text, /Esmaltação em gel por R\$ 89,90/)
    assert.match(text, /Válido até 31 de outubro/)
    assert.match(text, /https:\/\/x\.ikizy\.com/)
    assert.ok(text.endsWith(OPT_OUT_LINE))
  })

  it('número do WhatsApp e variantes com e sem o 9', () => {
    assert.equal(toWhatsappNumber('(11) 98765-4321'), '5511987654321')
    assert.equal(toWhatsappNumber('+55 11 98765-4321'), '5511987654321')
    assert.equal(toWhatsappNumber('123'), null)
    assert.deepEqual(phoneVariants('5511987654321'), ['5511987654321', '551187654321'])
    assert.deepEqual(phoneVariants('551187654321'), ['551187654321', '5511987654321'])
  })

  it('SAIR em qualquer forma conta como pedido para sair; frases normais não', () => {
    for (const t of ['SAIR', 'sair!', ' Parar ', 'Não quero', 'stop']) assert.ok(isOptOut(t), t)
    for (const t of ['quero sair às 18h', 'oi', '']) assert.ok(!isOptOut(t), t)
  })

  it('campanhas que sobram no mês = grátis restantes + extras', () => {
    assert.equal(campaignsLeft({ usedFree: 0, credits: 0 }), 1)
    assert.equal(campaignsLeft({ usedFree: 1, credits: 2 }), 2)
  })
})

// ---------------------------------------------------------------- criar campanha

describe('parseCampaignInput', () => {
  it('exige de 10 a 150 clientes, ids válidos e um modelo', () => {
    assert.equal(parseCampaignInput({ template: 'promocao', fields: {}, clientIds: ids(10) }).clientIds.length, 10)
    assert.throws(() => parseCampaignInput({ template: 'promocao', clientIds: ids(9) }), HttpError)
    assert.throws(() => parseCampaignInput({ template: 'promocao', clientIds: ids(151) }), HttpError)
    assert.throws(() => parseCampaignInput({ template: 'spam', clientIds: ids(10) }), HttpError)
    assert.throws(() => parseCampaignInput({ template: 'promocao', clientIds: ['x', ...ids(10)] }), HttpError)
  })
  it('ids repetidos contam uma vez', () => {
    assert.throws(() => parseCampaignInput({ template: 'novidade', clientIds: [...ids(9), ids(1)[0]] }), HttpError)
  })
})

describe('createCampaign', () => {
  const input = (n: number) => ({ template: 'promocao' as const, fields: { servico: 'Gel', preco: '89', validade: '2026-10-31' }, clientIds: ids(n) })

  it('monta o texto de cada cliente no servidor e pula quem está sem WhatsApp', async () => {
    const { db, calls } = fakeDb()
    const out = await createCampaign(deps(db), user, input(12))
    assert.deepEqual(out, { id: 'camp-1', total: 11, usedCredit: false })
    const p = calls.created[0]
    assert.equal(p.messages.length, 11)
    assert.equal(p.messages[0].phone, '5511900000000')
    assert.match(p.messages[0].body, /^Oi, Cliente!/)
    assert.match(p.preview, /^Oi, Maria!/)
    assert.equal(p.salonId, SALON)
  })

  it('menos de 10 com WhatsApp válido: nem chega no banco', async () => {
    const { db, calls } = fakeDb()
    await rejects(createCampaign(deps(db), user, input(10)), 400, 'too_few')
    assert.equal(calls.created.length, 0)
  })

  it('campos inválidos', async () => {
    const { db } = fakeDb()
    await rejects(createCampaign(deps(db), user, { ...input(12), fields: { servico: 'Gel' } }), 400, 'invalid_fields')
  })

  it('erros do banco viram mensagens claras', async () => {
    await rejects(createCampaign(deps(fakeDb({ create: { ok: false, error: 'no_quota' } }).db), user, input(12)), 402, 'no_quota')
    await rejects(createCampaign(deps(fakeDb({ create: { ok: false, error: 'not_connected' } }).db), user, input(12)), 409, 'not_connected')
    await rejects(createCampaign(deps(fakeDb({ create: { ok: false, error: 'too_few', eligible: 3 } }).db), user, input(12)), 400, 'too_few')
  })

  it('recepção e profissional não fazem campanha', async () => {
    const { db } = fakeDb({ member: { salonId: SALON, salonName: 'X', role: 'reception' } })
    await rejects(createCampaign(deps(db), user, input(12)), 403)
  })

  it('cancelar: id inválido, inexistente e ok', async () => {
    const { db } = fakeDb()
    await rejects(cancelCampaign(deps(db), user, 'x'), 400)
    await rejects(cancelCampaign(deps(db), user, ids(2)[1]), 404)
    assert.deepEqual(await cancelCampaign(deps(db), user, ids(1)[0]), { refunded: true })
  })
})

// ---------------------------------------------------------------- conexão

describe('WhatsApp do salão', () => {
  it('sem Evolution configurada: a tela mostra indisponível e conectar falha com 503', async () => {
    const { db } = fakeDb({ instance: null })
    const out = await getOverview(deps(db, null), user)
    assert.equal(out.available, false)
    assert.equal(out.whatsapp.state, 'close')
    await rejects(connectWhatsapp(deps(db, null), user), 503, 'whatsapp_unavailable')
  })

  it('conectar cria a instância do salão e devolve o QR code', async () => {
    const { db, calls } = fakeDb({ instance: null })
    const out = await connectWhatsapp(deps(db), user)
    assert.deepEqual(out, { state: 'connecting', qr: 'data:image/png;base64,AAA' })
    assert.deepEqual(calls.saved, [[`ikizy_${SALON.replace(/-/g, '')}`, 'connecting']])
  })

  it('a visão geral corrige o estado e retoma campanhas quando o celular voltou', async () => {
    const { db, calls } = fakeDb({ instance: { state: 'close' } })
    const out = await getOverview(deps(db), user)
    assert.equal(out.whatsapp.state, 'open')
    assert.equal(out.whatsapp.phone, '5511999990000')
    assert.deepEqual(calls.resumed, [SALON])
    assert.equal(out.quota.free, 1)
    assert.equal(out.canBuy, true)
  })
})

// ---------------------------------------------------------------- envio

const msg = (id: string, over: Partial<ClaimedMessage> = {}): ClaimedMessage => ({ id, salonId: SALON, instance: instanceName(SALON), phone: '5511900000001', body: 'Oi', ...over })

describe('dispatch', () => {
  it('só envia das 8h às 20h de São Paulo', async () => {
    assert.equal(saoPauloHour(new Date('2026-10-14T10:59:00Z')), 7)
    const { db } = fakeDb({ claimed: [msg('m1')] })
    const night = await dispatch(deps(db, fakeGateway().gateway, new Date('2026-10-14T23:30:00Z')))
    assert.equal('skipped' in night && night.skipped, 'hours')
  })

  it('envia, marca enviada e registra falhas por número', async () => {
    const { gateway, sent } = fakeGateway({
      sendText: async (i, n, t) => {
        if (n === 'bad') throw new GatewayError('invalid_number', 'Número sem WhatsApp.')
        sent.push([i, n, t])
      },
    })
    const { db, calls } = fakeDb({ claimed: [msg('m1'), msg('m2', { phone: 'bad' })] })
    const out = await dispatch(deps(db, gateway))
    assert.deepEqual(out, { sent: 1, failed: 1, paused: 0, retried: 0 })
    assert.equal(sent.length, 1)
    assert.deepEqual(calls.finished.sort(), [['m1', true, undefined], ['m2', false, 'Número sem WhatsApp.']])
  })

  it('WhatsApp caiu: devolve a mensagem para a fila e pausa as campanhas do salão', async () => {
    const { gateway } = fakeGateway({ sendText: async () => { throw new GatewayError('disconnected', 'x') } })
    const { db, calls } = fakeDb({ claimed: [msg('m1')] })
    const out = await dispatch(deps(db, gateway))
    assert.deepEqual(out, { sent: 0, failed: 0, paused: 1, retried: 0 })
    assert.deepEqual(calls.paused, [[SALON, 'm1']])
    assert.deepEqual(calls.states, [[instanceName(SALON), 'close']])
    assert.equal(calls.finished.length, 0)
  })
})

describe('dispatch · VPS fora do ar', () => {
  it('não perde a mensagem: volta para a fila sem pausar a campanha', async () => {
    const { gateway } = fakeGateway({ sendText: async () => { throw new GatewayError('unreachable', 'x') } })
    const { db, calls } = fakeDb({ claimed: [msg('m1')] })
    const out = await dispatch(deps(db, gateway))
    assert.deepEqual(out, { sent: 0, failed: 0, paused: 0, retried: 1 })
    assert.deepEqual(calls.requeued, ['m1'])
    assert.equal(calls.paused.length + calls.finished.length, 0)
  })
})

// ---------------------------------------------------------------- webhook da Evolution

describe('handleEvolutionEvent', () => {
  const name = instanceName(SALON)

  it('conectou: grava o estado e retoma; caiu: pausa', async () => {
    const { db, calls } = fakeDb()
    assert.equal(await handleEvolutionEvent(db, { event: 'connection.update', instance: name, data: { state: 'open' } }), 'state:open')
    assert.equal(await handleEvolutionEvent(db, { event: 'CONNECTION_UPDATE', instance: name, data: { state: 'close' } }), 'state:close')
    assert.deepEqual(calls.resumed, [SALON])
    assert.deepEqual(calls.paused, [[SALON, undefined]])
  })

  it('cliente respondeu SAIR: tira das ofertas (com e sem o 9); mensagens normais e do próprio salão não', async () => {
    const { db, calls } = fakeDb()
    const upsert = (text: string, key: Record<string, unknown>) => ({ event: 'messages.upsert', instance: name, data: { key, message: { conversation: text } } })
    assert.equal(await handleEvolutionEvent(db, upsert('Sair', { remoteJid: '5511987654321@s.whatsapp.net', fromMe: false })), 'opt_out:1')
    await handleEvolutionEvent(db, upsert('sair', { remoteJid: '5511900000000@s.whatsapp.net', fromMe: true }))
    await handleEvolutionEvent(db, upsert('Oi, quero marcar', { remoteJid: '5511900000000@s.whatsapp.net', fromMe: false }))
    // contas novas: id @lid e o número em senderPn
    await handleEvolutionEvent(db, { event: 'messages.upsert', instance: name, data: { key: { remoteJid: '123@lid', senderPn: '551187654321@s.whatsapp.net' }, message: { extendedTextMessage: { text: 'PARAR' } } } })
    assert.deepEqual(calls.optOut, [
      ['5511987654321', '551187654321'],
      ['551187654321', '5511987654321'],
    ])
  })

  it('instância que não é nossa é ignorada', async () => {
    const { db, calls } = fakeDb()
    assert.equal(await handleEvolutionEvent(db, { event: 'connection.update', instance: 'outra', data: { state: 'open' } }), 'ignored')
    assert.equal(await handleEvolutionEvent(db, { event: 'connection.update', instance: 'ikizy_x', data: { state: 'open' } }), 'unknown_instance')
    assert.equal(calls.resumed.length, 0)
  })

  it('segredo do webhook', () => {
    assert.ok(sameSecret('abc', 'abc'))
    assert.ok(!sameSecret('abc', 'abd'))
    assert.ok(!sameSecret('', ''))
  })
})

// ---------------------------------------------------------------- cliente HTTP da Evolution

describe('createEvolutionGateway', () => {
  function fakeFetch(routes: Record<string, [number, unknown]>) {
    const calls: { method: string; path: string; body: unknown; apikey: string | null }[] = []
    const f = (async (url: string, init: RequestInit) => {
      const path = url.replace('https://evo.test', '')
      calls.push({ method: init.method ?? 'GET', path, body: init.body ? JSON.parse(String(init.body)) : undefined, apikey: new Headers(init.headers).get('apikey') })
      const key = Object.keys(routes).find((k) => `${init.method} ${path}`.startsWith(k))
      const [status, data] = key ? routes[key] : [404, { error: 'not found' }]
      return new Response(JSON.stringify(data), { status })
    }) as unknown as typeof fetch
    return { f, calls }
  }

  it('instância nova: cria com webhook e devolve o QR', async () => {
    const { f, calls } = fakeFetch({
      'GET /instance/connectionState/ikizy_a': [404, {}],
      'POST /instance/create': [201, { instance: { instanceName: 'ikizy_a' }, qrcode: { base64: 'data:image/png;base64,QR' } }],
      'POST /webhook/set/ikizy_a': [201, {}],
    })
    const gw = createEvolutionGateway({ url: 'https://evo.test/', apiKey: 'k', fetch: f })
    assert.deepEqual(await gw.connect('ikizy_a', 'https://hook'), { state: 'connecting', qr: 'data:image/png;base64,QR' })
    assert.equal(calls[1].path, '/instance/create')
    assert.deepEqual((calls[1].body as Record<string, any>).webhook.events, ['CONNECTION_UPDATE', 'MESSAGES_UPSERT'])
    assert.ok(calls.every((c) => c.apikey === 'k'))
  })

  it('já conectada não pede QR; envio sem WhatsApp vira invalid_number; caiu vira disconnected', async () => {
    const open = fakeFetch({
      'GET /instance/connectionState/ikizy_a': [200, { instance: { state: 'open' } }],
      'GET /instance/fetchInstances': [200, [{ ownerJid: '5511999990000@s.whatsapp.net' }]],
      'POST /message/sendText/ikizy_a': [400, { response: { message: [{ exists: false, number: '55119' }] } }],
    })
    const gw = createEvolutionGateway({ url: 'https://evo.test', apiKey: 'k', fetch: open.f })
    assert.deepEqual(await gw.connect('ikizy_a', 'h'), { state: 'open', qr: null })
    assert.deepEqual(await gw.state('ikizy_a'), { state: 'open', phone: '5511999990000' })
    await assert.rejects(gw.sendText('ikizy_a', '55119', 'oi'), (e: unknown) => e instanceof GatewayError && e.kind === 'invalid_number')

    const closed = fakeFetch({
      'GET /instance/connectionState/ikizy_a': [200, { instance: { state: 'close' } }],
      'POST /message/sendText/ikizy_a': [500, { error: 'Connection Closed' }],
    })
    const gw2 = createEvolutionGateway({ url: 'https://evo.test', apiKey: 'k', fetch: closed.f })
    await assert.rejects(gw2.sendText('ikizy_a', '5511900000000', 'oi'), (e: unknown) => e instanceof GatewayError && e.kind === 'disconnected')
  })
})

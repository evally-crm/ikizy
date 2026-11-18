import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HttpError } from './billing.js'
import { changedRequestPayload, newRequestPayload, parseSubscription, pushNewRequest, subscribe, unsubscribe, type PushDb, type PushSender, type StoredSubscription } from './push.js'

// chaves no formato de verdade: P-256 público (65 bytes = 87 letras) e segredo de autenticação (16 bytes = 22 letras)
const P256DH = 'B'.repeat(87)
const AUTH = 'a'.repeat(22)
const FCM = 'https://fcm.googleapis.com/fcm/send/abc123:APA91bExemplo'
const good = (endpoint = FCM) => ({ endpoint, keys: { p256dh: P256DH, auth: AUTH } })

const rejects = (fn: () => unknown) => assert.throws(fn, (e) => e instanceof HttpError && e.status === 400)

describe('parseSubscription (a trava contra chamar a rede errada)', () => {
  it('aceita os serviços de push dos navegadores', () => {
    for (const endpoint of [
      FCM,
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
      'https://web.push.apple.com/QGoh',
      'https://api.push.apple.com/3/device/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) {
      assert.equal(parseSubscription(good(endpoint)).endpoint, endpoint, endpoint)
    }
  })

  it('recusa qualquer endereço fora da lista, inclusive rede interna e truques de endereço', () => {
    for (const endpoint of [
      'http://fcm.googleapis.com/fcm/send/x', // sem https
      'https://169.254.169.254/latest/meta-data', // metadados da nuvem
      'https://localhost/x',
      'https://127.0.0.1/x',
      'https://evil.com/fcm.googleapis.com',
      'https://fcm.googleapis.com.evil.com/x', // domínio que só começa igual
      'https://evilfcm.googleapis.com.attacker.io/x',
      'https://user:pass@fcm.googleapis.com/x', // com credenciais
      'https://fcm.googleapis.com:8443/x', // porta diferente
      'ftp://fcm.googleapis.com/x',
      'javascript:alert(1)',
      'não é um endereço',
      '',
    ]) {
      rejects(() => parseSubscription(good(endpoint)))
    }
  })

  it('recusa endereço gigante e chaves que não parecem chaves', () => {
    rejects(() => parseSubscription(good(FCM + 'a'.repeat(1000))))
    rejects(() => parseSubscription({ endpoint: FCM, keys: { p256dh: 'curta', auth: AUTH } }))
    rejects(() => parseSubscription({ endpoint: FCM, keys: { p256dh: P256DH, auth: 'x' } }))
    rejects(() => parseSubscription({ endpoint: FCM, keys: { p256dh: '!'.repeat(87), auth: AUTH } }))
    rejects(() => parseSubscription({ endpoint: FCM }))
    rejects(() => parseSubscription(null))
    rejects(() => parseSubscription({ endpoint: 42, keys: {} }))
  })
})

function fakeDb(over: { role?: string | null; subs?: StoredSubscription[]; salon?: string | null } = {}) {
  const log: string[] = []
  const db: PushDb = {
    async salonIdBySlug() {
      return over.salon === undefined ? 'salon-1' : over.salon
    },
    async roleOf() {
      return over.role === undefined ? 'owner' : over.role
    },
    async save(userId, salonId, sub, ua) {
      log.push(`save:${userId}:${salonId}:${sub.endpoint.slice(0, 25)}:${ua ?? '-'}`)
    },
    async remove(userId, endpoint) {
      log.push(`remove:${userId}:${endpoint.slice(0, 25)}`)
    },
    async listForSalon() {
      return over.subs ?? []
    },
    async drop(endpoint) {
      log.push(`drop:${endpoint}`)
    },
  }
  return { db, log }
}

describe('ligar e desligar o aviso', () => {
  it('quem trata pedidos liga o aviso neste aparelho', async () => {
    for (const role of ['owner', 'manager', 'reception']) {
      const { db, log } = fakeDb({ role })
      assert.deepEqual(await subscribe(db, { id: 'u1' }, 'salon-1', { subscription: good() }, 'Chrome no Windows'), { ok: true })
      assert.ok(log[0].startsWith('save:u1:salon-1:https://fcm.googleapis.co'), role)
    }
  })

  it('profissional e quem não tem negócio recebem 403 e nada é gravado', async () => {
    for (const role of ['professional', null]) {
      const { db, log } = fakeDb({ role })
      await assert.rejects(subscribe(db, { id: 'u1' }, 'salon-1', { subscription: good() }, null), (e) => e instanceof HttpError && e.status === 403)
      assert.deepEqual(log, [])
    }
  })

  it('aparelho inválido não chega ao banco', async () => {
    const { db, log } = fakeDb()
    await assert.rejects(subscribe(db, { id: 'u1' }, 'salon-1', { subscription: good('https://evil.com/x') }, null))
    assert.deepEqual(log, [])
  })

  it('desligar remove só o aparelho da própria pessoa', async () => {
    const { db, log } = fakeDb()
    await unsubscribe(db, { id: 'u1' }, { endpoint: FCM })
    assert.ok(log[0].startsWith('remove:u1:'))
    await assert.rejects(unsubscribe(db, { id: 'u1' }, {}), (e) => e instanceof HttpError && e.status === 400)
  })
})

describe('aviso de pedido novo', () => {
  const request = { id: 'req-1', startsAt: '2026-11-20T13:00:00Z', service: 'Corte', clientName: 'Ana Souza' }
  const sub = (n: number): StoredSubscription => ({ userId: `u${n}`, endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: P256DH, auth: AUTH } })

  it('o texto traz quem pediu, o quê e quando, e leva direto ao pedido', () => {
    const p = newRequestPayload(request)
    assert.equal(p.title, 'Novo pedido pelo site')
    assert.ok(p.body.includes('Ana Souza pediu Corte') && p.body.includes('10:00'))
    assert.equal(p.url, '/dashboard/agenda?pedido=req-1')
    assert.equal(p.tag, 'request:req-1')
  })

  it('manda para todos os aparelhos de quem trata pedidos', async () => {
    const sent: string[] = []
    const send: PushSender = async (s) => {
      sent.push(s.endpoint)
      return { status: 201 }
    }
    const { db } = fakeDb({ subs: [sub(1), sub(2), sub(3)] })
    assert.deepEqual(await pushNewRequest({ db, send }, 'studio', request), { sent: 3, dropped: 0 })
    assert.equal(sent.length, 3)
  })

  it('leva o número de pedidos esperando para o ícone do app, e segue sem ele se a contagem falhar', async () => {
    const seen: (number | undefined)[] = []
    const send: PushSender = async (_s, p) => {
      seen.push(p.badge)
      return { status: 201 }
    }
    const { db } = fakeDb({ subs: [sub(1)] })
    db.pendingCount = async () => 3
    await pushNewRequest({ db, send }, 'studio', request)
    db.pendingCount = async () => {
      throw new Error('banco')
    }
    await pushNewRequest({ db, send }, 'studio', request)
    assert.deepEqual(seen, [3, undefined])
  })

  it('apaga o aparelho que saiu (404 e 410) e segue com os outros', async () => {
    const send: PushSender = async (s) => ({ status: s.endpoint.endsWith('/2') ? 410 : s.endpoint.endsWith('/3') ? 404 : 201 })
    const { db, log } = fakeDb({ subs: [sub(1), sub(2), sub(3)] })
    assert.deepEqual(await pushNewRequest({ db, send }, 'studio', request), { sent: 1, dropped: 2 })
    assert.deepEqual(log.filter((l) => l.startsWith('drop:')).sort(), ['drop:https://fcm.googleapis.com/fcm/send/2', 'drop:https://fcm.googleapis.com/fcm/send/3'])
  })

  it('um aparelho que dá erro não impede os outros nem derruba o pedido', async () => {
    const send: PushSender = async (s) => {
      if (s.endpoint.endsWith('/1')) throw new Error('rede caiu')
      return { status: 201 }
    }
    const { db } = fakeDb({ subs: [sub(1), sub(2)] })
    assert.deepEqual(await pushNewRequest({ db, send }, 'studio', request), { sent: 1, dropped: 0 })
  })

  it('negócio sem aparelhos, ou que não existe, não faz nada; falha no banco não lança', async () => {
    const send: PushSender = async () => {
      throw new Error('não podia chamar')
    }
    assert.deepEqual(await pushNewRequest({ db: fakeDb({ subs: [] }).db, send }, 'studio', request), { sent: 0, dropped: 0 })
    assert.deepEqual(await pushNewRequest({ db: fakeDb({ salon: null }).db, send }, 'studio', request), { sent: 0, dropped: 0 })
    const broken = fakeDb().db
    broken.listForSalon = async () => {
      throw new Error('banco fora do ar')
    }
    assert.deepEqual(await pushNewRequest({ db: broken, send }, 'studio', request), { sent: 0, dropped: 0 })
  })
})

describe('aviso de remarcação e cancelamento', () => {
  const base = { startsAt: '2026-11-20T17:00:00.000Z', service: 'Esmaltação em gel', clientName: 'Ana' }
  it('remarcado diz o novo horário e cancelado diz o que foi cancelado', () => {
    const a = changedRequestPayload({ ...base, kind: 'remarcado' })
    assert.equal(a.title, 'Pedido remarcado')
    assert.match(a.body, /^Ana remarcou Esmaltação em gel para /)
    const b = changedRequestPayload({ ...base, kind: 'cancelado' })
    assert.equal(b.title, 'Pedido cancelado')
    assert.match(b.body, /^Ana cancelou Esmaltação em gel · /)
    assert.notEqual(a.tag, b.tag)
    assert.equal(a.url, '/dashboard/agenda')
  })
})

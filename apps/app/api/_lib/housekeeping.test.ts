import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AccountDb, AccountDeps, AuditEntry } from './account.js'
import { MAX_ORPHANS_PER_RUN, MAX_PURGES_PER_RUN, RETENTION_DAYS, runHousekeeping, type HousekeepingDb, type RetentionCandidate } from './housekeeping.js'

const NOW = new Date('2026-11-16T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const ago = (days: number) => new Date(NOW.getTime() - days * DAY)
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function candidate(n: number, over: Partial<RetentionCandidate> = {}): RetentionCandidate {
  return { salonId: id(n), name: `Negócio ${n}`, slug: `negocio-${n}`, status: 'canceled', accessUntil: ago(95), notifyEmail: `dona${n}@x.com`, warnedAt: null, ...over }
}

function setup(opts: { due?: number[]; candidates?: RetentionCandidate[]; orphans?: string[]; sendFails?: boolean; purgeFails?: string } = {}) {
  const log: string[] = []
  const audits: AuditEntry[] = []
  const claimed = new Set<string>()
  const db = {
    async dueDeletions() {
      return (opts.due ?? []).map((n) => ({ salonId: id(n), name: `Negócio ${n}`, slug: `negocio-${n}` }))
    },
    async stripeCustomer() {
      return null
    },
    async deleteSalon(salonId: string, audit?: AuditEntry) {
      if (opts.purgeFails === salonId) throw new Error('banco falhou')
      log.push(`deleteSalon:${salonId}`)
      if (audit) audits.push(audit)
    },
    async deleteUser(userId: string) {
      log.push(`deleteUser:${userId}`)
    },
    async ownerOf(salonId: string) {
      return `owner-of-${salonId.slice(-2)}`
    },
    async contactsOf(salonId: string) {
      return { ownerEmail: `login-${salonId.slice(-2)}@x.com`, memberEmails: [] }
    },
    async audit(entry: AuditEntry) {
      audits.push(entry)
    },
  } as unknown as AccountDb
  const hk: HousekeepingDb = {
    async retentionCandidates() {
      return opts.candidates ?? []
    },
    async claimWarning(salonId) {
      if (claimed.has(salonId)) return false
      claimed.add(salonId)
      return true
    },
    async releaseWarning(salonId) {
      claimed.delete(salonId)
    },
    async orphanLogins(_now, protect, limit) {
      log.push(`orphans:protect=${protect.join('|')}:limit=${limit}`)
      return opts.orphans ?? []
    },
    async deleteUsers(ids) {
      log.push(`deleteUsers:${ids.length}`)
      return ids.length
    },
    async deleteStaleInvites() {
      return 3
    },
  }
  const deps: AccountDeps & { hk: HousekeepingDb; protectEmails: string[] } = {
    db,
    hk,
    protectEmails: ['master@ikizy.com'],
    async deleteCustomer() {},
    async setCancelAtPeriodEnd() {},
    async deletePhotos(prefix) {
      log.push(`photos:${prefix}`)
    },
    async send(mail) {
      if (opts.sendFails) throw new Error('resend fora do ar')
      log.push(`mail:${mail.to}:${mail.subject}`)
    },
    appUrl: 'https://app.ikizy.com',
    now: () => NOW,
  }
  return { deps, log, audits }
}

const deleted = (log: string[]) => log.filter((l) => l.startsWith('deleteSalon:')).length

describe('limpeza: exclusões pedidas pela dona', () => {
  it('apaga o negócio vencido, o login da dona, deixa registro e avisa', async () => {
    const { deps, log, audits } = setup({ due: [1] })
    const r = await runHousekeeping(deps)
    assert.equal(r.purgedRequested, 1)
    assert.ok(log.includes(`deleteSalon:${id(1)}`))
    assert.ok(log.includes('deleteUser:owner-of-01'))
    assert.ok(log.some((l) => l.startsWith('mail:login-01@x.com:Sua conta do IKIZY foi excluída')))
    assert.equal(audits[0].actorKind, 'system')
    assert.equal(audits[0].action, 'system.purge_salon')
    assert.equal(audits[0].details?.reason, 'requested')
  })

  it('há um teto por execução: o excesso fica para o dia seguinte', async () => {
    const { deps, log } = setup({ due: [1, 2, 3, 4, 5, 6, 7, 8] })
    const r = await runHousekeeping(deps)
    assert.equal(r.purgedRequested, MAX_PURGES_PER_RUN)
    assert.equal(deleted(log), MAX_PURGES_PER_RUN)
  })

  it('uma que falha não impede as outras', async () => {
    const { deps, log } = setup({ due: [1, 2, 3], purgeFails: id(2) })
    const r = await runHousekeeping(deps)
    assert.equal(r.purgedRequested, 2)
    assert.ok(log.includes(`deleteSalon:${id(3)}`))
  })
})

describe('limpeza: retenção de 90 dias', () => {
  it('aos 83 dias manda o aviso (uma vez só) e não apaga', async () => {
    const c = candidate(1, { accessUntil: ago(84) })
    const { deps, log } = setup({ candidates: [c] })
    const r1 = await runHousekeeping(deps)
    assert.equal(r1.retentionWarned, 1)
    assert.equal(deleted(log), 0)
    assert.ok(log.some((l) => l.startsWith('mail:dona1@x.com:') && l.includes('serão apagados')))
    const r2 = await runHousekeeping(deps)
    assert.equal(r2.retentionWarned, 0)
  })

  it('antes dos 83 dias não faz nada', async () => {
    const { deps, log } = setup({ candidates: [candidate(1, { accessUntil: ago(60) })] })
    const r = await runHousekeeping(deps)
    assert.deepEqual([r.retentionWarned, r.retentionPurged], [0, 0])
    assert.deepEqual(log.filter((l) => l.startsWith('mail:') || l.startsWith('deleteSalon')), [])
  })

  it('passou dos 90 dias mas o aviso é recente: não apaga (o aviso vem 7 dias antes)', async () => {
    const { deps, log } = setup({ candidates: [candidate(1, { accessUntil: ago(95), warnedAt: ago(2) })] })
    const r = await runHousekeeping(deps)
    assert.equal(r.retentionPurged, 0)
    assert.equal(deleted(log), 0)
  })

  it('passou dos 90 dias e o aviso tem 7 dias ou mais: apaga, registra o motivo e avisa', async () => {
    const { deps, log, audits } = setup({ candidates: [candidate(1, { accessUntil: ago(97), warnedAt: ago(8) })] })
    const r = await runHousekeeping(deps)
    assert.equal(r.retentionPurged, 1)
    assert.ok(log.includes(`deleteSalon:${id(1)}`))
    assert.equal(audits[0].details?.reason, 'retention')
    assert.ok(log.some((l) => l.includes('foi apagado do IKIZY')))
  })

  it('passou dos 90 dias, sem aviso e com e-mail: avisa primeiro, não apaga', async () => {
    const { deps, log } = setup({ candidates: [candidate(1, { accessUntil: ago(100) })] })
    const r = await runHousekeeping(deps)
    assert.equal(r.retentionWarned, 1)
    assert.equal(deleted(log), 0)
  })

  it('sem e-mail para avisar, apaga aos 90 dias', async () => {
    const { deps, log } = setup({ candidates: [candidate(1, { accessUntil: ago(RETENTION_DAYS + 1), notifyEmail: null })] })
    const r = await runHousekeeping(deps)
    assert.equal(r.retentionPurged, 1)
    assert.ok(log.includes(`deleteSalon:${id(1)}`))
  })

  it('negócio com assinatura ativa nunca é apagado, mesmo com a data vencida', async () => {
    const { deps, log } = setup({ candidates: [candidate(1, { status: 'active', accessUntil: ago(200), warnedAt: ago(100) })] })
    const r = await runHousekeeping(deps)
    assert.deepEqual([r.retentionWarned, r.retentionPurged], [0, 0])
    assert.equal(deleted(log), 0)
  })

  it('o teto de apagados por execução vale para o conjunto (pedidas + retenção)', async () => {
    const cands = [1, 2, 3, 4, 5, 6].map((n) => candidate(n, { accessUntil: ago(100), warnedAt: ago(10) }))
    const { deps, log } = setup({ due: [20, 21], candidates: cands })
    await runHousekeeping(deps)
    assert.equal(deleted(log), MAX_PURGES_PER_RUN)
  })

  it('falha no envio do aviso devolve a reserva, para tentar de novo amanhã', async () => {
    const c = candidate(1, { accessUntil: ago(84) })
    const { deps } = setup({ candidates: [c], sendFails: true })
    assert.equal((await runHousekeeping(deps)).retentionWarned, 0)
    deps.send = async () => {}
    assert.equal((await runHousekeeping(deps)).retentionWarned, 1)
  })
})

describe('limpeza: logins largados e convites', () => {
  it('apaga os órfãos, protegendo os e-mails do master, e registra a quantidade', async () => {
    const { deps, log, audits } = setup({ orphans: ['a', 'b'] })
    const r = await runHousekeeping(deps)
    assert.equal(r.orphanLogins, 2)
    assert.equal(r.staleInvites, 3)
    assert.ok(log.includes(`orphans:protect=master@ikizy.com:limit=${MAX_ORPHANS_PER_RUN}`))
    assert.deepEqual(audits.at(-1)?.details, { count: 2 })
  })

  it('sem órfãos, não apaga nem registra nada', async () => {
    const { deps, log, audits } = setup()
    await runHousekeeping(deps)
    assert.equal(log.some((l) => l.startsWith('deleteUsers')), false)
    assert.deepEqual(audits, [])
  })
})

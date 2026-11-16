import { notify, wipeSalon, type AccountDeps } from './account.js'
import { renderClosedEmail, renderRetentionWarnEmail } from './accountEmail.js'
import { reportError } from './monitoring.js'

/**
 * limpeza diária (uma tarefa só do cron):
 *   1. apaga os negócios cuja exclusão pedida pela dona já passou dos 7 dias;
 *   2. retenção (R-107): negócio sem acesso há 90 dias é apagado, com aviso por e-mail 7 dias antes;
 *   3. logins que nunca viraram negócio (cadastro largado) e convites vencidos há muito tempo.
 * Tudo que apaga deixa uma linha no `audit_log`. Por segurança, há um teto de negócios apagados por execução:
 * se um defeito escolher gente demais, o estrago para no teto e o excesso vai para o monitoramento.
 */

/** dias sem acesso até apagar */
export const RETENTION_DAYS = 90
/** o aviso sai 7 dias antes */
export const WARN_DAYS_BEFORE = 7
/** teto de negócios apagados por execução (a tarefa roda todo dia, então o resto fica para amanhã) */
export const MAX_PURGES_PER_RUN = 5
/** teto de logins órfãos apagados por execução */
export const MAX_ORPHANS_PER_RUN = 100

const DAY_MS = 24 * 60 * 60 * 1000

export interface RetentionCandidate {
  salonId: string
  name: string
  slug: string
  status: string
  accessUntil: Date
  /** e-mail de avisos da dona (subscriptions.notify_email) */
  notifyEmail: string | null
  /** quando o aviso de limpeza foi enviado (null = ainda não) */
  warnedAt: Date | null
}

export interface HousekeepingDb {
  /** negócios sem assinatura ativa e com o acesso vencido há pelo menos 83 dias */
  retentionCandidates(now: Date): Promise<RetentionCandidate[]>
  /** reserva o aviso (uma vez só por negócio); false = já foi enviado */
  claimWarning(salonId: string, to: string): Promise<boolean>
  releaseWarning(salonId: string): Promise<void>
  /** logins sem negócio: não confirmados há mais de 7 dias, ou confirmados e parados há mais de 90 (nunca os e-mails protegidos) */
  orphanLogins(now: Date, protectEmails: string[], limit: number): Promise<string[]>
  deleteUsers(ids: string[]): Promise<number>
  deleteStaleInvites(now: Date): Promise<number>
}

export interface HousekeepingDeps extends AccountDeps {
  hk: HousekeepingDb
  /** e-mails que nunca são limpos como "login órfão" (o master pode não ter negócio) */
  protectEmails: string[]
}

export interface HousekeepingReport {
  purgedRequested: number
  retentionWarned: number
  retentionPurged: number
  orphanLogins: number
  staleInvites: number
}

const now = (deps: AccountDeps) => (deps.now ?? (() => new Date()))()

/** apaga o negócio, o login da dona e avisa quem perdeu o acesso */
async function purge(deps: AccountDeps, salon: { salonId: string; name: string; slug: string }, reason: string, extra: Record<string, unknown>, ownerEmailFallback?: string | null) {
  const contacts = await deps.db.contactsOf(salon.salonId)
  const owner = await deps.db.ownerOf(salon.salonId)
  const { hadCard } = await wipeSalon(deps, salon.salonId, {
    actorKind: 'system',
    action: 'system.purge_salon',
    salonId: salon.salonId,
    salonName: salon.name,
    salonSlug: salon.slug,
    details: { reason, ...extra },
  })
  if (owner) await deps.db.deleteUser(owner)
  const kind = reason === 'retention' ? 'expired' : 'self'
  await notify(deps, contacts.ownerEmail ?? ownerEmailFallback, renderClosedEmail(kind, salon.name, hadCard))
  for (const to of contacts.memberEmails) await notify(deps, to, renderClosedEmail('member', salon.name, false))
}

export async function runHousekeeping(deps: HousekeepingDeps): Promise<HousekeepingReport> {
  const report: HousekeepingReport = { purgedRequested: 0, retentionWarned: 0, retentionPurged: 0, orphanLogins: 0, staleInvites: 0 }
  const t = now(deps)
  let purges = 0

  // 1. exclusões pedidas pela dona e já vencidas
  try {
    const due = await deps.db.dueDeletions(t)
    if (due.length > MAX_PURGES_PER_RUN) reportError(new Error(`${due.length} exclusões vencidas; apagando só ${MAX_PURGES_PER_RUN} por execução`), 'limpeza: teto de exclusões')
    for (const salon of due.slice(0, MAX_PURGES_PER_RUN)) {
      try {
        await purge(deps, salon, 'requested', {})
        report.purgedRequested++
        purges++
      } catch (error) {
        reportError(error, `limpeza: exclusão pedida ${salon.slug}`)
      }
    }
  } catch (error) {
    reportError(error, 'limpeza: exclusões pedidas')
  }

  // 2. retenção: aviso aos 83 dias, exclusão aos 90 (e só 7 dias depois do aviso)
  try {
    for (const c of await deps.hk.retentionCandidates(t)) {
      if (c.status === 'active') continue
      const age = t.getTime() - c.accessUntil.getTime()
      if (age < (RETENTION_DAYS - WARN_DAYS_BEFORE) * DAY_MS) continue

      const warned = c.warnedAt && t.getTime() - c.warnedAt.getTime() >= WARN_DAYS_BEFORE * DAY_MS
      const canPurge = age >= RETENTION_DAYS * DAY_MS && (warned || !c.notifyEmail)
      if (canPurge) {
        if (purges >= MAX_PURGES_PER_RUN) continue
        try {
          await purge(deps, c, 'retention', { accessUntil: c.accessUntil.toISOString() }, c.notifyEmail)
          report.retentionPurged++
          purges++
        } catch (error) {
          reportError(error, `limpeza: retenção ${c.slug}`)
        }
        continue
      }

      // ainda sem aviso (ou aviso recente): manda o aviso uma vez
      if (c.notifyEmail && !c.warnedAt && (await deps.hk.claimWarning(c.salonId, c.notifyEmail))) {
        const deleteOn = new Date(Math.max(c.accessUntil.getTime() + RETENTION_DAYS * DAY_MS, t.getTime() + WARN_DAYS_BEFORE * DAY_MS))
        try {
          await deps.send({ to: c.notifyEmail, ...renderRetentionWarnEmail(c.name, deleteOn, `${deps.appUrl}/dashboard/assinatura`) })
          report.retentionWarned++
        } catch (error) {
          await deps.hk.releaseWarning(c.salonId)
          reportError(error, `limpeza: aviso de retenção ${c.slug}`)
        }
      }
    }
  } catch (error) {
    reportError(error, 'limpeza: retenção')
  }

  // 3. logins órfãos e convites vencidos
  try {
    const ids = await deps.hk.orphanLogins(t, deps.protectEmails, MAX_ORPHANS_PER_RUN)
    if (ids.length) {
      report.orphanLogins = await deps.hk.deleteUsers(ids)
      await deps.db.audit({ actorKind: 'system', action: 'system.purge_orphan_logins', details: { count: report.orphanLogins } }).catch((e) => reportError(e, 'registro de limpeza'))
    }
    report.staleInvites = await deps.hk.deleteStaleInvites(t)
  } catch (error) {
    reportError(error, 'limpeza: logins órfãos')
  }

  return report
}

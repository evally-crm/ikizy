import { reportError } from './monitoring.js'
import { daysLeft } from '../../src/lib/plans.js'
import type { BillingMethod, BillingStatus } from '../../src/lib/plans.js'
import { renderBrandEmail } from './emailLayout.js'

/** assinatura com o e-mail de aviso da dona, como o banco devolve */
export interface ReminderCandidate {
  salonId: string
  salonName: string
  email: string | null
  status: BillingStatus
  method: BillingMethod | null
  cancelAtPeriodEnd: boolean
  accessUntil: Date
}

export type ReminderKind = 'trial' | 'pix' | 'canceled' | 'past_due' | 'ended'

export interface PlannedReminder {
  /** chave única do aviso (não repete) */
  key: string
  kind: ReminderKind
  salonId: string
  salonName: string
  to: string
  accessUntil: Date
  /** dias que faltam (0 quando já terminou) */
  days: number
}

/** avisamos quando faltam 7, 3 e 1 dia; depois que acabou, só nos 3 dias seguintes */
export const REMINDER_DAYS = [1, 3, 7] as const
const ENDED_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/**
 * decide quais avisos mandar agora. Cada negócio recebe no máximo um por rodada: o da menor marca (1, 3 ou 7 dias)
 * que já foi atingida; se o cron falhar um dia, o aviso sai atrasado em vez de perdido (e nunca vêm vários de uma vez).
 */
export function planReminders(list: ReminderCandidate[], now = new Date()): PlannedReminder[] {
  const planned: PlannedReminder[] = []
  for (const c of list) {
    if (!c.email) continue
    const base = { salonId: c.salonId, salonName: c.salonName, to: c.email, accessUntil: c.accessUntil }
    const day = isoDay(c.accessUntil)
    const msLeft = c.accessUntil.getTime() - now.getTime()

    if (msLeft <= 0) {
      if (-msLeft <= ENDED_WINDOW_MS) planned.push({ ...base, kind: 'ended', key: `ended:${c.salonId}:${day}`, days: 0 })
      continue
    }
    const days = daysLeft(c.accessUntil, now)
    if (c.status === 'past_due') {
      planned.push({ ...base, kind: 'past_due', key: `past_due:${c.salonId}:${day}`, days })
      continue
    }
    // cartão ativo renova sozinho: nada a avisar
    const renewsByItself = c.method === 'card' && c.status !== 'canceled' && !c.cancelAtPeriodEnd
    if (renewsByItself) continue

    const mark = REMINDER_DAYS.find((m) => days <= m)
    if (mark === undefined) continue
    const kind: ReminderKind = c.status === 'canceled' || c.cancelAtPeriodEnd ? 'canceled' : c.status === 'trialing' ? 'trial' : 'pix'
    planned.push({ ...base, kind, key: `ending:${c.salonId}:${day}:${mark}`, days })
  }
  return planned
}

const dateBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
const daysText = (n: number) => (n <= 1 ? 'amanhã' : `em ${n} dias`)

interface Copy {
  subject: string
  title: string
  lead: string
  button: string
}

function copyFor(r: PlannedReminder): Copy {
  const until = dateBR(r.accessUntil)
  switch (r.kind) {
    case 'trial':
      return {
        subject: `Seu teste do IKIZY acaba ${daysText(r.days)}`,
        title: 'Seu teste está acabando',
        lead: `O teste grátis de ${r.salonName} termina ${daysText(r.days)} (${until}). Escolha como pagar para continuar com a agenda, o site e os pedidos online sem interrupção. Depois do fim, o sistema abre só para consulta.`,
        button: 'Escolher plano',
      }
    case 'pix':
      return {
        subject: `Seu acesso ao IKIZY acaba ${daysText(r.days)}`,
        title: 'Seu período está acabando',
        lead: `O período pago de ${r.salonName} vai até ${until}. O Pix não renova sozinho: renove para continuar usando sem interrupção.`,
        button: 'Renovar acesso',
      }
    case 'canceled':
      return {
        subject: `Sua assinatura do IKIZY termina ${daysText(r.days)}`,
        title: 'Sua assinatura está terminando',
        lead: `O acesso de ${r.salonName} continua até ${until}. Se quiser seguir com o IKIZY, é só reativar a assinatura.`,
        button: 'Reativar assinatura',
      }
    case 'past_due':
      return {
        subject: 'Não conseguimos cobrar seu cartão do IKIZY',
        title: 'Cobrança não concluída',
        lead: `A última cobrança de ${r.salonName} não passou. Atualize o cartão até ${until} para não perder o acesso.`,
        button: 'Atualizar cartão',
      }
    case 'ended':
      return {
        subject: 'Seu acesso ao IKIZY terminou',
        title: 'Seu acesso terminou',
        lead: `O acesso de ${r.salonName} terminou em ${until}. O sistema está aberto só para consulta e os seus dados continuam guardados. Reative quando quiser.`,
        button: 'Reativar acesso',
      }
  }
}

/** assunto, HTML e texto simples do aviso; `link` é a tela de assinatura do app */
export function renderReminderEmail(r: PlannedReminder, link: string) {
  const c = copyFor(r)
  const mail = renderBrandEmail({
    title: c.title,
    paragraphs: [c.lead],
    button: c.button,
    link,
    footer: `Você recebeu este aviso porque é a responsável por ${r.salonName}.`,
  })
  return { subject: c.subject, ...mail }
}

// ---------------------------------------------------------------- envio

export interface ReminderDb {
  candidates(): Promise<ReminderCandidate[]>
  /** reserva o aviso; false = já foi enviado (ou está sendo) */
  claim(r: PlannedReminder): Promise<boolean>
  /** devolve a reserva quando o envio falhou, para tentar de novo na próxima rodada */
  release(key: string): Promise<void>
}

export type SendEmail = (message: { to: string; subject: string; html: string; text: string }) => Promise<void>

export interface RemindersResult {
  planned: number
  sent: number
  skipped: number
  failed: number
}

export async function runReminders(deps: { db: ReminderDb; send: SendEmail; link: string; now?: Date }): Promise<RemindersResult> {
  const { db, send, link } = deps
  const plan = planReminders(await db.candidates(), deps.now)
  const result: RemindersResult = { planned: plan.length, sent: 0, skipped: 0, failed: 0 }
  for (const reminder of plan) {
    if (!(await db.claim(reminder))) {
      result.skipped += 1
      continue
    }
    try {
      await send({ to: reminder.to, ...renderReminderEmail(reminder, link) })
      result.sent += 1
    } catch (error) {
      reportError(error, `lembrete ${reminder.kind}`)
      await db.release(reminder.key)
      result.failed += 1
    }
  }
  return result
}

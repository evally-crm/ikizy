import { daysLeft } from '../../src/lib/plans.js'
import type { BillingMethod, BillingStatus } from '../../src/lib/plans.js'

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

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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
  const text = [c.lead, '', `${c.button}: ${link}`, '', 'IKIZY, a agenda simples do seu salão.'].join('\n')
  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(c.title)}</title></head>
<body style="margin:0;padding:0;background-color:#e8e8ea;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8e8ea;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">
    <tr><td bgcolor="#800513" style="background-color:#800513;border-radius:22px;padding:22px 24px 28px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:13px;font-weight:500;letter-spacing:4px;color:#ffffff;">IKIZY</div>
      <div style="padding-top:28px;font-size:34px;line-height:38px;letter-spacing:-1px;color:#ffffff;">${esc(c.title)}</div>
    </td></tr>
    <tr><td height="4" style="height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:22px;padding:28px 24px;font-family:Arial,Helvetica,sans-serif;">
      <p style="margin:0 0 22px;font-size:16px;line-height:24px;color:#0e0d0d;">${esc(c.lead)}</p>
      <a href="${esc(link)}" style="display:inline-block;padding:13px 22px;border-radius:999px;background-color:#800513;color:#ffffff;font-size:15px;text-decoration:none;">${esc(c.button)}</a>
      <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid rgba(14,13,13,0.12);font-size:12px;line-height:18px;color:#6b6668;">IKIZY, a agenda simples do seu salão. Você recebeu este aviso porque é a responsável por ${esc(r.salonName)}.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
  return { subject: c.subject, html, text }
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
      console.error('lembrete', reminder.kind, reminder.salonId, error)
      await db.release(reminder.key)
      result.failed += 1
    }
  }
  return result
}

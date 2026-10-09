import { HttpError } from './billing.js'
import { esc } from './siteHtml.js'

/**
 * Convite da equipe por e-mail. A dona cria o convite no app (com o e-mail da pessoa) e pede o envio aqui;
 * o servidor confere que ela é a dona daquele salão, limita os reenvios e manda pelo Resend.
 */

export type InviteRole = 'manager' | 'reception' | 'professional'

const ROLE_LABEL: Record<InviteRole, string> = {
  manager: 'gerente',
  reception: 'recepção',
  professional: 'profissional',
}

export interface InviteForEmail {
  id: string
  salonId: string
  salonName: string
  token: string
  role: InviteRole
  name: string
  email: string | null
  expiresAt: Date
  acceptedAt: Date | null
  emailSentAt: Date | null
  emailCount: number
}

export interface InviteEmailDb {
  getMembership(userId: string): Promise<{ salonId: string; role: string } | null>
  getInvite(inviteId: string): Promise<InviteForEmail | null>
  /** marca o envio só se ainda estiver dentro dos limites (atômico); false = outro envio passou na frente */
  claimSend(inviteId: string, maxSends: number, minSecondsBetween: number): Promise<boolean>
  /** o envio falhou: devolve a vaga para a dona poder tentar de novo na hora */
  releaseSend(inviteId: string): Promise<void>
}

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  /** o Resend descarta envios repetidos com a mesma chave */
  idempotencyKey: string
}

export type SendEmail = (email: OutgoingEmail) => Promise<void>

export const MAX_SENDS = 5
export const MIN_SECONDS_BETWEEN = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseInviteEmailInput(body: unknown): { inviteId: string } {
  const b = (body ?? {}) as Record<string, unknown>
  if (typeof b.inviteId !== 'string' || !UUID.test(b.inviteId)) throw new HttpError(400, 'invalid_invite', 'Convite inválido.')
  return { inviteId: b.inviteId }
}

/** por que este convite não pode ser enviado agora (null = pode) */
export function blockReason(invite: InviteForEmail, now: Date): HttpError | null {
  if (!invite.email) return new HttpError(400, 'no_email', 'Este convite não tem e-mail. Mande o link pelo WhatsApp.')
  if (invite.acceptedAt) return new HttpError(409, 'invite_used', 'Este convite já foi aceito.')
  if (invite.expiresAt.getTime() <= now.getTime()) return new HttpError(410, 'invite_expired', 'Este convite venceu. Crie um novo.')
  if (invite.emailCount >= MAX_SENDS) return new HttpError(429, 'too_many_sends', 'Este convite já foi enviado muitas vezes. Mande o link pelo WhatsApp.')
  if (invite.emailSentAt && now.getTime() - invite.emailSentAt.getTime() < MIN_SECONDS_BETWEEN * 1000) {
    return new HttpError(429, 'too_soon', 'O e-mail acabou de ser enviado. Aguarde um minuto para reenviar.')
  }
  return null
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })

/** assunto, HTML (com estilos inline, como os clientes de e-mail exigem) e texto puro */
export function renderInviteEmail(p: { salonName: string; inviterName: string | null; name: string; role: InviteRole; url: string; expiresAt: Date }) {
  const who = p.inviterName?.trim() || p.salonName
  const first = p.name.trim().split(/\s+/)[0]
  const role = ROLE_LABEL[p.role]
  const until = dateFmt.format(p.expiresAt)
  const subject = `${who} convidou você para a equipe de ${p.salonName}`

  const text = [
    `Oi, ${first}!`,
    '',
    `${who} convidou você para entrar na equipe de ${p.salonName} no IKIZY, como ${role}.`,
    '',
    `Para aceitar, abra o link abaixo e crie sua conta (ou entre com a que você já tem):`,
    p.url,
    '',
    `O convite vale até ${until} e pode ser usado uma única vez.`,
    'Se você não esperava este convite, é só ignorar este e-mail.',
    '',
    'IKIZY · gestão simples para negócios de beleza',
  ].join('\n')

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:Helvetica,Arial,sans-serif;color:#0e0d0d">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;padding:36px 32px">
        <tr><td style="font-size:22px;font-weight:700;letter-spacing:-0.5px;padding-bottom:28px">IKIZY<span style="color:#bf0c22">.</span></td></tr>
        <tr><td style="font-size:24px;line-height:1.3;font-weight:600;padding-bottom:12px">Oi, ${esc(first)}! Você foi convidada para uma equipe</td></tr>
        <tr><td style="font-size:16px;line-height:1.55;color:#242424;padding-bottom:28px">
          <strong>${esc(who)}</strong> convidou você para entrar na equipe de <strong>${esc(p.salonName)}</strong> no IKIZY, como <strong>${esc(role)}</strong>.
          Crie sua conta (ou entre com a que você já tem) e aceite o convite.
        </td></tr>
        <tr><td style="padding-bottom:28px">
          <a href="${esc(p.url)}" style="display:inline-block;background:#800513;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:999px">Aceitar convite</a>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.5;color:#6b6668;padding-bottom:8px">
          O convite vale até ${esc(until)} e pode ser usado uma única vez. Se o botão não abrir, copie este link:<br>
          <a href="${esc(p.url)}" style="color:#800513;word-break:break-all">${esc(p.url)}</a>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.5;color:#6b6668">Se você não esperava este convite, é só ignorar este e-mail.</td></tr>
      </table>
      <p style="font-size:12px;color:#6b6668;margin:16px 0 0">IKIZY · gestão simples para negócios de beleza</p>
    </td></tr>
  </table>
</body></html>`

  return { subject, html, text }
}

interface Deps {
  db: InviteEmailDb
  send: SendEmail
  appUrl: string
  now?: Date
}

/** só a dona do salão do convite envia; devolve para quem foi */
export async function sendInviteEmail(deps: Deps, user: { id: string; email?: string; name?: string }, input: { inviteId: string }) {
  const now = deps.now ?? new Date()
  const member = await deps.db.getMembership(user.id)
  if (!member) throw new HttpError(404, 'no_salon', 'Você ainda não tem um negócio cadastrado.')
  if (member.role !== 'owner') throw new HttpError(403, 'not_owner', 'Só a dona do negócio envia convites.')

  const invite = await deps.db.getInvite(input.inviteId)
  // convite de outro salão responde igual a inexistente: não revela que ele existe
  if (!invite || invite.salonId !== member.salonId) throw new HttpError(404, 'invite_not_found', 'Convite não encontrado.')
  const blocked = blockReason(invite, now)
  if (blocked) throw blocked

  if (!(await deps.db.claimSend(invite.id, MAX_SENDS, MIN_SECONDS_BETWEEN))) {
    throw new HttpError(429, 'too_soon', 'O e-mail acabou de ser enviado. Aguarde um minuto para reenviar.')
  }

  const url = `${deps.appUrl}/convite/${invite.token}`
  const email = renderInviteEmail({ salonName: invite.salonName, inviterName: user.name ?? null, name: invite.name, role: invite.role, url, expiresAt: invite.expiresAt })
  try {
    await deps.send({
      to: invite.email as string,
      ...email,
      replyTo: user.email,
      idempotencyKey: `invite-${invite.id}-${invite.emailCount + 1}`,
    })
  } catch (error) {
    await deps.db.releaseSend(invite.id)
    throw error
  }
  return { sentTo: invite.email as string }
}

/** envio pelo Resend (API HTTP; sem SDK) */
export function resendSender(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): SendEmail {
  return async (email) => {
    let res: Response
    try {
      res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'idempotency-key': email.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        }),
      })
    } catch {
      throw new HttpError(502, 'email_failed', 'Não foi possível enviar o e-mail agora. Mande o link pelo WhatsApp.')
    }
    if (!res.ok) {
      console.error('resend', res.status, await res.text().catch(() => ''))
      throw new HttpError(502, 'email_failed', 'Não foi possível enviar o e-mail agora. Mande o link pelo WhatsApp.')
    }
  }
}

import { createPublicKey, verify } from 'node:crypto'
import { closingText, paragraph, renderShell } from './emailLayout.js'

/**
 * E-mails de acesso (código de confirmação) no lugar do texto padrão do Neon Auth.
 * O Neon Auth chama o webhook `send.otp` em vez de mandar o e-mail; aqui a assinatura é conferida e o e-mail sai pelo Resend.
 * O desenho é o de apps/landing/email/verificar-email.html (flor servida em https://ikizy.com/email/flor.png).
 */

export const FROM = 'IKIZY <nao-responda@ikizy.com>'
const MAX_AGE_MS = 5 * 60 * 1000

export interface OtpEvent {
  eventType: string
  code: string
  otpType: string
  email: string
}

type Jwk = { kid?: string } & Record<string, unknown>

/** confere a assinatura Ed25519 (JWS destacado) que o Neon Auth manda em cada webhook; devolve o JSON já lido */
export function verifyNeonWebhook(rawBody: string, headers: Headers, jwks: { keys: Jwk[] }, now = Date.now()): unknown {
  const signature = headers.get('x-neon-signature')
  const kid = headers.get('x-neon-signature-kid')
  const timestamp = headers.get('x-neon-timestamp')
  if (!signature || !kid || !timestamp) throw new Error('missing_headers')

  const jwk = jwks.keys.find((k) => k.kid === kid)
  if (!jwk) throw new Error('unknown_key')

  const [headerB64, middle, signatureB64] = signature.split('.')
  if (!headerB64 || middle !== '' || !signatureB64) throw new Error('bad_signature_format')

  const payloadB64 = Buffer.from(rawBody, 'utf8').toString('base64url')
  const signingInput = `${headerB64}.${Buffer.from(`${timestamp}.${payloadB64}`, 'utf8').toString('base64url')}`
  const key = createPublicKey({ key: jwk as never, format: 'jwk' })
  if (!verify(null, Buffer.from(signingInput), key, Buffer.from(signatureB64, 'base64url'))) throw new Error('invalid_signature')

  const age = now - Number.parseInt(timestamp, 10)
  if (!Number.isFinite(age) || age > MAX_AGE_MS || age < -MAX_AGE_MS) throw new Error('stale_timestamp')
  return JSON.parse(rawBody)
}

/** tira do corpo do webhook só o que o e-mail precisa; `null` se não for um `send.otp` por e-mail */
export function parseOtpEvent(payload: unknown): OtpEvent | null {
  const p = payload as {
    event_type?: unknown
    user?: { email?: unknown }
    event_data?: { otp_code?: unknown; otp_type?: unknown; delivery_preference?: unknown }
  }
  if (p?.event_type !== 'send.otp') return null
  const code = p.event_data?.otp_code
  const email = p.user?.email
  if (typeof code !== 'string' || !/^\d{4,10}$/.test(code)) return null
  if (typeof email !== 'string' || !email.includes('@')) return null
  if (p.event_data?.delivery_preference === 'sms') return null
  const otpType = typeof p.event_data?.otp_type === 'string' ? p.event_data.otp_type : 'email-verification'
  return { eventType: 'send.otp', code, otpType, email }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const COPY: Record<string, { first: string; rest: string; sub: string; subject: string; lead: string; reason: string }> = {
  'email-verification': {
    first: 'Confirme',
    rest: 'seu e-mail',
    sub: 'Código enviado.',
    subject: 'Seu código de confirmação do IKIZY',
    lead: 'Olá! Falta só um passo para abrir a sua agenda no IKIZY. Digite o código abaixo na tela do cadastro.',
    reason: 'foi usado para criar uma conta no IKIZY',
  },
  'forget-password': {
    first: 'Redefina',
    rest: 'sua senha',
    sub: 'Redefinição solicitada.',
    subject: 'Seu código para redefinir a senha do IKIZY',
    lead: 'Recebemos um pedido para redefinir a senha da sua conta no IKIZY. Digite o código abaixo para continuar.',
    reason: 'pediu para redefinir a senha no IKIZY',
  },
  'sign-in': {
    first: 'Entre',
    rest: 'no IKIZY',
    sub: 'Acesso solicitado.',
    subject: 'Seu código de acesso ao IKIZY',
    lead: 'Use o código abaixo para entrar na sua conta do IKIZY.',
    reason: 'pediu um código de acesso ao IKIZY',
  },
}

/** assunto, HTML e texto simples do e-mail do código */
export function renderOtpEmail(code: string, email: string, otpType = 'email-verification') {
  const c = COPY[otpType] ?? COPY['email-verification']
  const subject = `${c.subject}: ${code}`
  const text = [
    c.lead,
    '',
    `Seu código: ${code}`,
    'Ele vale por alguns minutos.',
    '',
    'Não foi você? Pode ignorar este e-mail, ninguém entra na conta sem o código. Nunca pedimos esse código por WhatsApp ou telefone.',
    '',
    closingText(`Você recebeu este e-mail porque ${email} ${c.reason}.`),
  ].join('\n')

  const html = renderShell({
    eyebrow: c.first,
    title: c.rest,
    subtitle: c.sub,
    preheader: `Seu código IKIZY é ${code}. Ele vale por alguns minutos.`,
    body: `${paragraph(c.lead)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
  <tr><td align="center" bgcolor="#f5f5f7" style="background-color:#f5f5f7;border-radius:20px;padding:20px 16px;">
    <div style="font-size:12px;line-height:18px;color:#6b6668;">Seu código</div>
    <div class="digits" style="padding:6px 0;font-family:'Architype Stedelijk','Outfit',Arial,Helvetica,sans-serif;font-size:56px;line-height:62px;letter-spacing:6px;color:#0e0d0d;">${esc(code)}</div>
    <div style="font-size:12px;line-height:18px;color:#6b6668;">vale por alguns minutos</div>
  </td></tr>
</table>
<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#a3a3a8;">Não foi você? Pode ignorar este e-mail, ninguém entra na conta sem o código. Nunca pedimos esse código por WhatsApp ou telefone.</p>`,
    footer: `Você recebeu este e-mail porque ${email} ${c.reason}.`,
  })

  return { subject, html, text }
}

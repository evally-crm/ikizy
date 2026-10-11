import { createPublicKey, verify } from 'node:crypto'

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

const COPY: Record<string, { first: string; rest: string; subject: string; lead: string; reason: string }> = {
  'email-verification': {
    first: 'Confirme',
    rest: 'seu e-mail',
    subject: 'Seu código de confirmação do IKIZY',
    lead: 'Olá! Falta só um passo para abrir a sua agenda no IKIZY. Digite o código abaixo na tela do cadastro.',
    reason: 'foi usado para criar uma conta no IKIZY',
  },
  'forget-password': {
    first: 'Redefina',
    rest: 'sua senha',
    subject: 'Seu código para redefinir a senha do IKIZY',
    lead: 'Recebemos um pedido para redefinir a senha da sua conta no IKIZY. Digite o código abaixo para continuar.',
    reason: 'pediu para redefinir a senha no IKIZY',
  },
  'sign-in': {
    first: 'Entre',
    rest: 'no IKIZY',
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
    `IKIZY, a agenda simples do seu salão. Você recebeu este e-mail porque ${email} ${c.reason}.`,
  ].join('\n')

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(c.first)} ${esc(c.rest)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .bg-page { background-color: #0a0a0a !important; }
    .bg-card { background-color: #161515 !important; }
    .bg-soft { background-color: #232222 !important; }
    .t-ink { color: #f5f5f7 !important; }
    .t-body { color: #e8e8ea !important; }
    .t-muted { color: #a3a3a8 !important; }
    .btn-cell { background-color: #f5f5f7 !important; }
    .btn-text { color: #0e0d0d !important; }
  }
  @media (max-width: 480px) {
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
    .digits { font-size: 40px !important; }
  }
</style>
</head>
<body class="bg-page" style="margin:0;padding:0;background-color:#e8e8ea;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Seu código IKIZY é ${esc(code)}. Ele vale por alguns minutos.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="bg-page" style="background-color:#e8e8ea;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">
    <tr><td bgcolor="#800513" style="background-color:#800513;border-radius:22px;overflow:hidden;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr><td style="padding:22px 24px 0;font-family:'Outfit',Arial,Helvetica,sans-serif;font-size:13px;font-weight:500;letter-spacing:4px;color:#ffffff;">IKIZY</td></tr>
        <tr><td style="padding:0;line-height:0;font-size:0;"><img src="https://ikizy.com/email/flor.png" width="560" alt="" style="display:block;width:100%;height:auto;border:0;"></td></tr>
        <tr><td class="pad" style="padding:0 24px 28px;font-family:'Outfit',Arial,Helvetica,sans-serif;font-size:40px;line-height:43px;font-weight:400;letter-spacing:-1.4px;color:#ffffff;">
          <span style="display:block;color:#e0b8be;">${esc(c.first)}</span>${esc(c.rest)}
        </td></tr>
      </table>
    </td></tr>
    <tr><td height="4" style="height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td class="bg-card pad" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:22px;padding:28px 24px;font-family:'Outfit',Arial,Helvetica,sans-serif;">
      <p class="t-ink" style="margin:0 0 20px;font-size:17px;line-height:26px;color:#0e0d0d;">${esc(c.lead)}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr><td class="bg-soft" align="center" bgcolor="#f5f5f7" style="background-color:#f5f5f7;border-radius:18px;padding:18px 16px;">
          <div class="t-muted" style="font-size:12px;line-height:18px;color:#6b6668;">Seu código</div>
          <div class="digits t-ink" style="padding:6px 0;font-family:'Geist Pixel',ui-monospace,'Courier New',monospace;font-size:56px;line-height:62px;letter-spacing:6px;color:#0e0d0d;">${esc(code)}</div>
          <div class="t-muted" style="font-size:12px;line-height:18px;color:#800513;">vale por alguns minutos</div>
        </td></tr>
      </table>
      <p class="t-muted" style="margin:24px 0 0;padding-top:16px;border-top:1px solid rgba(14,13,13,0.12);font-size:13px;line-height:20px;color:#6b6668;">Não foi você? Pode ignorar este e-mail, ninguém entra na conta sem o código. Nunca pedimos esse código por WhatsApp ou telefone.</p>
    </td></tr>
    <tr><td height="4" style="height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td bgcolor="#0e0d0d" class="pad" style="background-color:#0e0d0d;border-radius:22px;padding:22px 24px;font-family:'Outfit',Arial,Helvetica,sans-serif;">
      <div style="font-size:13px;font-weight:500;letter-spacing:4px;color:#c8102e;">IKIZY</div>
      <div style="padding:10px 0;font-family:'Geist Pixel',ui-monospace,'Courier New',monospace;font-size:18px;line-height:22px;color:#ffffff;">a agenda simples do seu salão</div>
      <div style="font-size:12px;line-height:18px;color:#a3a3a8;">Você recebeu este e-mail porque ${esc(email)} ${esc(c.reason)}.</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`

  return { subject, html, text }
}

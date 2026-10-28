/** moldura dos e-mails do IKIZY: faixa vinho com o título, cartão branco com o texto e um botão */

export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface BrandEmail {
  title: string
  /** parágrafos em texto simples (são escapados) */
  paragraphs: string[]
  /** linhas "rótulo: valor" num quadro cinza, ex.: os dados de um pedido */
  details?: [label: string, value: string][]
  button: string
  link: string
  /** rodapé: por que a pessoa recebeu */
  footer: string
}

export function renderBrandEmail(m: BrandEmail): { html: string; text: string } {
  const details = m.details?.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;background-color:#f1f1f3;border-radius:16px;">${m.details
        .map(
          ([label, value]) =>
            `<tr><td style="padding:10px 16px 0;font-size:12px;line-height:16px;color:#6b6668;">${escHtml(label)}</td></tr><tr><td style="padding:2px 16px 10px;font-size:16px;line-height:22px;color:#0e0d0d;">${escHtml(value)}</td></tr>`,
        )
        .join('')}</table>`
    : ''
  const paragraphs = m.paragraphs.map((p) => `<p style="margin:0 0 22px;font-size:16px;line-height:24px;color:#0e0d0d;">${escHtml(p)}</p>`).join('')
  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escHtml(m.title)}</title></head>
<body style="margin:0;padding:0;background-color:#e8e8ea;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8e8ea;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">
    <tr><td bgcolor="#63001f" style="background-color:#63001f;border-radius:22px;padding:22px 24px 28px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:13px;font-weight:500;letter-spacing:4px;color:#ffffff;">IKIZY</div>
      <div style="padding-top:28px;font-size:34px;line-height:38px;letter-spacing:-1px;color:#ffffff;">${escHtml(m.title)}</div>
    </td></tr>
    <tr><td height="4" style="height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:22px;padding:28px 24px;font-family:Arial,Helvetica,sans-serif;">
      ${paragraphs}${details}
      <a href="${escHtml(m.link)}" style="display:inline-block;padding:13px 22px;border-radius:999px;background-color:#63001f;color:#ffffff;font-size:15px;text-decoration:none;">${escHtml(m.button)}</a>
      <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid rgba(14,13,13,0.12);font-size:12px;line-height:18px;color:#6b6668;">IKIZY, a agenda simples do seu salão. ${escHtml(m.footer)}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
  const text = [
    ...m.paragraphs.flatMap((p) => [p, '']),
    ...(m.details?.length ? [...m.details.map(([l, v]) => `${l}: ${v}`), ''] : []),
    `${m.button}: ${m.link}`,
    '',
    `IKIZY, a agenda simples do seu salão. ${m.footer}`,
  ].join('\n')
  return { html, text }
}

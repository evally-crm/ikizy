/**
 * moldura dos e-mails do IKIZY: uma superfície só, vinho, com o coelho no topo, o conteúdo no meio e o rodapé com a logo e o Instagram.
 * As imagens ficam em apps/landing/public/email (geradas por apps/landing/scripts/email-arte.ts) e saem de https://ikizy.com/email.
 */

export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const IMG = 'https://ikizy.com/email'
export const INSTAGRAM = { handle: '@ikizy.app', url: 'https://instagram.com/ikizy.app' }

export const FONT = "'Outfit','Arial Black',Arial,Helvetica,sans-serif"
export const WINE = '#63001f'
export const PINK = '#e0b8be'

export interface Shell {
  /** título grande, sobre o coelho; `eyebrow` é a primeira linha, em rosa */
  title: string
  eyebrow?: string
  /** texto escondido que aparece ao lado do assunto na caixa de entrada */
  preheader?: string
  /** HTML do miolo (já escapado) */
  body: string
  /** por que a pessoa recebeu */
  footer: string
}

export function renderShell(m: Shell): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escHtml(m.eyebrow ? `${m.eyebrow} ${m.title}` : m.title)}</title>
<style>
  @font-face { font-family: 'Architype Stedelijk'; src: url('https://ikizy.com/fonts/architype-stedelijk.woff2') format('woff2'), url('https://ikizy.com/fonts/architype-stedelijk.woff') format('woff'); }
  @media (prefers-color-scheme: dark) {
    .bg-page { background-color: #0a0a0a !important; }
    .surface { border: 1px solid rgba(255,255,255,0.14) !important; }
  }
  @media (max-width: 480px) {
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
    .big { font-size: 34px !important; line-height: 36px !important; }
    .digits { font-size: 40px !important; }
    .num { font-size: 72px !important; line-height: 72px !important; }
  }
</style>
</head>
<body class="bg-page" style="margin:0;padding:0;background-color:#e8e8ea;">
${m.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escHtml(m.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="bg-page" style="background-color:#e8e8ea;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" class="surface" bgcolor="${WINE}" style="width:100%;max-width:560px;background-color:${WINE};border-radius:28px;overflow:hidden;">
    <tr><td class="pad" style="padding:24px 28px 0;font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:4px;color:#ffffff;">IKIZY</td></tr>
    <tr><td style="padding:0;line-height:0;font-size:0;"><img src="${IMG}/coelho.png" width="560" alt="" style="display:block;width:100%;height:auto;border:0;"></td></tr>
    <tr><td class="pad big" style="padding:0 28px 8px;font-family:${FONT};font-size:44px;line-height:46px;font-weight:800;letter-spacing:-1.6px;color:#ffffff;">${m.eyebrow ? `<span style="display:block;color:${PINK};">${escHtml(m.eyebrow)}</span>` : ''}${escHtml(m.title)}</td></tr>
    <tr><td class="pad" style="padding:14px 28px 8px;font-family:${FONT};">${m.body}</td></tr>
    <tr><td class="pad" style="padding:24px 28px 28px;font-family:${FONT};">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td valign="middle" style="padding-right:12px;"><img src="${IMG}/logo-coelho.png" height="44" alt="IKIZY" style="display:block;height:44px;width:auto;border:0;"></td>
          <td valign="middle" style="font-size:20px;line-height:24px;font-weight:700;color:#ffffff;">a agenda simples<br>do seu salão</td>
        </tr>
      </table>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;">
        <tr>
          <td valign="middle" style="padding-right:8px;"><a href="${INSTAGRAM.url}"><img src="${IMG}/instagram.png" width="22" height="22" alt="Instagram" style="display:block;border:0;"></a></td>
          <td valign="middle" style="font-size:15px;line-height:22px;"><a href="${INSTAGRAM.url}" style="color:#ffffff;text-decoration:none;">${INSTAGRAM.handle}</a></td>
        </tr>
      </table>
      <p style="margin:18px 0 0;font-size:12px;line-height:18px;color:${PINK};">${escHtml(m.footer)}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

/** botão branco em pílula, com o texto vinho */
export const button = (label: string, link: string) =>
  `<a href="${escHtml(link)}" style="display:inline-block;padding:15px 28px;border-radius:999px;background-color:#ffffff;color:${WINE};font-family:${FONT};font-size:16px;font-weight:700;text-decoration:none;">${escHtml(label)}</a>`

export const paragraph = (text: string) =>
  `<p style="margin:0 0 22px;font-size:17px;line-height:26px;color:#ffffff;">${escHtml(text)}</p>`

export interface BrandEmail {
  title: string
  /** parágrafos em texto simples (são escapados) */
  paragraphs: string[]
  /** linhas "rótulo: valor" num quadro, ex.: os dados de um pedido */
  details?: [label: string, value: string][]
  button: string
  link: string
  /** rodapé: por que a pessoa recebeu */
  footer: string
}

/** o trecho de texto simples que fecha todos os e-mails */
export const closingText = (footer: string) => [`IKIZY, a agenda simples do seu salão. Instagram ${INSTAGRAM.handle}: ${INSTAGRAM.url}`, footer].join('\n')

export function renderBrandEmail(m: BrandEmail): { html: string; text: string } {
  const details = m.details?.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background-color:#7d1a3a;border-radius:18px;">${m.details
        .map(
          ([label, value]) =>
            `<tr><td style="padding:12px 18px 0;font-size:12px;line-height:16px;color:${PINK};">${escHtml(label)}</td></tr><tr><td style="padding:2px 18px 12px;font-size:17px;line-height:23px;color:#ffffff;">${escHtml(value)}</td></tr>`,
        )
        .join('')}</table>`
    : ''
  const html = renderShell({
    title: m.title,
    body: `${m.paragraphs.map(paragraph).join('')}${details}${button(m.button, m.link)}`,
    footer: m.footer,
  })
  const text = [
    ...m.paragraphs.flatMap((p) => [p, '']),
    ...(m.details?.length ? [...m.details.map(([l, v]) => `${l}: ${v}`), ''] : []),
    `${m.button}: ${m.link}`,
    '',
    closingText(m.footer),
  ].join('\n')
  return { html, text }
}

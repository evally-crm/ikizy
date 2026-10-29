/**
 * moldura dos e-mails do IKIZY: uma superfície só, vinho, com o coelho no topo, o conteúdo no meio e o rodapé com a logo e o Instagram.
 * As imagens ficam em apps/landing/public/email (geradas por apps/landing/scripts/email-arte.ts) e saem de https://ikizy.com/email.
 */

export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const IMG = 'https://ikizy.com/email'
export const INSTAGRAM = { handle: '@ikizy.app', url: 'https://instagram.com/ikizy.app' }

export const FONT = "'Outfit',Arial,Helvetica,sans-serif"
export const INK = '#0e0d0d'
export const LIGHT = '#e8e8ea'
export const GREY = '#a3a3a8'

export interface Shell {
  /** título grande, sobre o coelho; `eyebrow` é a primeira linha, em rosa */
  title: string
  eyebrow?: string
  /** texto escondido que aparece ao lado do assunto na caixa de entrada */
  preheader?: string
  /** linha curta abaixo do título, em negrito, ex.: "Pedido recebido." */
  subtitle?: string
  /** HTML do miolo (já escapado) */
  body: string
  /** por que a pessoa recebeu */
  footer: string
}

/** título em duas linhas, a primeira branca e a segunda rosa; sem `eyebrow`, divide as palavras ao meio */
function titleLines(m: Pick<Shell, 'title' | 'eyebrow'>): [string, string] {
  if (m.eyebrow) return [m.eyebrow, m.title]
  const words = m.title.trim().split(/\s+/)
  if (words.length < 2) return [m.title, '']
  const k = Math.ceil(words.length / 2)
  return [words.slice(0, k).join(' '), words.slice(k).join(' ')]
}

export function renderShell(m: Shell): string {
  const [line1, line2] = titleLines(m)
  const title = `<span style="display:block;color:#ffffff;">${escHtml(line1)}</span>${line2 ? `<span style="display:block;color:${GREY};">${escHtml(line2)}.</span>` : ''}`
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
    .big { font-size: 36px !important; line-height: 36px !important; }
    .digits { font-size: 40px !important; }
    .num { font-size: 72px !important; line-height: 72px !important; }
  }
</style>
</head>
<body class="bg-page" style="margin:0;padding:0;background-color:#e8e8ea;">
${m.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escHtml(m.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="bg-page" style="background-color:#e8e8ea;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" class="surface" bgcolor="${INK}" style="width:100%;max-width:560px;background-color:${INK};border-radius:28px;overflow:hidden;">
    <tr><td class="pad" style="padding:24px 28px 0;font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:4px;color:#c8102e;">IKIZY</td></tr>
    <tr><td class="pad" style="padding:8px 28px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td valign="middle" class="big" style="font-family:${FONT};font-size:50px;line-height:50px;font-weight:300;letter-spacing:-1.8px;color:#ffffff;">${title}${m.subtitle ? `<span style="display:block;padding-top:16px;font-size:17px;line-height:22px;font-weight:500;letter-spacing:0;color:#ffffff;">${escHtml(m.subtitle)}</span>` : ''}</td>
          <td valign="bottom" align="right" width="160" style="width:160px;line-height:0;font-size:0;"><img src="${IMG}/coelho.png" width="160" alt="" style="display:block;width:160px;height:auto;border:0;"></td>
        </tr>
      </table>
    </td></tr>
    <tr><td class="pad" style="padding:14px 28px 8px;font-family:${FONT};">${m.body}</td></tr>
    <tr><td class="pad" style="padding:24px 28px 28px;font-family:${FONT};">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td valign="middle" style="padding-right:12px;"><img src="${IMG}/logo-coelho.png" height="44" alt="IKIZY" style="display:block;height:44px;width:auto;border:0;"></td>
          <td valign="middle" style="font-size:20px;line-height:24px;font-weight:400;color:#ffffff;">a agenda simples<br>do seu salão</td>
        </tr>
      </table>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;">
        <tr>
          <td valign="middle" style="padding-right:8px;"><a href="${INSTAGRAM.url}"><img src="${IMG}/instagram.png" width="22" height="22" alt="Instagram" style="display:block;border:0;"></a></td>
          <td valign="middle" style="font-size:15px;line-height:22px;"><a href="${INSTAGRAM.url}" style="color:#ffffff;text-decoration:none;">${INSTAGRAM.handle}</a></td>
        </tr>
      </table>
      <p style="margin:18px 0 0;font-size:12px;line-height:18px;color:${GREY};">${escHtml(m.footer)}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

/** botão branco em pílula, com o texto vinho */
export const button = (label: string, link: string) =>
  `<a href="${escHtml(link)}" style="display:inline-block;padding:15px 28px;border-radius:999px;background-color:#ffffff;color:${INK};font-family:${FONT};font-size:16px;font-weight:500;text-decoration:none;">${escHtml(label)}</a>`

export const paragraph = (text: string) =>
  `<p style="margin:0 0 22px;font-size:17px;line-height:26px;color:#ffffff;">${escHtml(text)}</p>`

export interface BrandEmail {
  title: string
  subtitle?: string
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
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background-color:#232222;border-radius:18px;">${m.details
        .map(
          ([label, value]) =>
            `<tr><td style="padding:12px 18px 0;font-size:12px;line-height:16px;color:${GREY};">${escHtml(label)}</td></tr><tr><td style="padding:2px 18px 12px;font-size:17px;line-height:23px;color:#ffffff;">${escHtml(value)}</td></tr>`,
        )
        .join('')}</table>`
    : ''
  const html = renderShell({
    title: m.title,
    subtitle: m.subtitle,
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

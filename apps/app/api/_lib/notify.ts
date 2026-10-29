import { reportError } from './monitoring.js'
import { TRIAL_DAYS } from '../../src/lib/plans.js'
import { FONT, IMG, GREY, INK, LIGHT, button, closingText, escHtml, paragraph, renderBrandEmail, renderShell } from './emailLayout.js'
import type { SendEmail } from './reminders.js'

/** e-mails avulsos para a dona: novo pedido do site (E5) e boas-vindas (E3). Nunca derrubam a ação que os disparou. */

export interface OwnerContact {
  salonId: string
  salonName: string
  /** e-mail de avisos da dona (`subscriptions.notify_email`); sem ele não há para quem mandar */
  email: string | null
}

export interface NotifyDb {
  /** dona do negócio pelo endereço do site */
  ownerBySlug(slug: string): Promise<OwnerContact | null>
  /** negócios que a pessoa criou nos últimos dias (só eles ganham boas-vindas; os antigos não) */
  recentOwnedSalons(userId: string): Promise<OwnerContact[]>
  /** reserva o envio; false = já foi enviado (ou está sendo) */
  claim(key: string, salonId: string, to: string, template: string): Promise<boolean>
  /** devolve a reserva quando o envio falhou */
  release(key: string): Promise<void>
}

export interface NewRequest {
  id: string
  startsAt: string
  service: string
  professional: string | null
  clientName: string
  clientPhone: string
}

const TZ = 'America/Sao_Paulo'

/** "terça-feira, 20 de outubro às 10:00" no fuso de Brasília */
export function whenBR(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
  const time = d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  return `${day} às ${time}`
}

/** "(11) 99999-8888" a partir só dos dígitos (com ou sem o 55 do país) */
export function phoneBR(digits: string): string {
  const d = digits.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

export function renderNewRequestEmail(salonName: string, r: NewRequest, link: string) {
  const when = whenBR(r.startsAt)
  const mail = renderBrandEmail({
    title: 'Novo pedido pelo site',
    subtitle: 'Falta você confirmar.',
    paragraphs: [`${r.clientName} pediu um horário em ${salonName}. Confirme ou recuse para a cliente saber se pode vir.`],
    details: [
      ['Serviço', r.service],
      ['Quando', when],
      ...(r.professional ? ([['Com', r.professional]] as [string, string][]) : []),
      ['Cliente', r.clientName],
      ['WhatsApp', phoneBR(r.clientPhone)],
    ],
    button: 'Ver o pedido',
    link,
    footer: `Você recebeu este aviso porque é a responsável por ${salonName}.`,
  })
  return { subject: `Novo pedido: ${r.service}, ${when}`, ...mail }
}

/** os três primeiros passos, cada um com uma tela do sistema */
const STEPS: { shot: string; title: string; text: string }[] = [
  { shot: 'agenda', title: 'Arrume a agenda', text: 'Confira o horário de atendimento e ajuste os preços dos serviços.' },
  { shot: 'site', title: 'Publique o seu site', text: 'Depois, ligue o agendamento online para as clientes pedirem horário sozinhas.' },
  { shot: 'inicio', title: 'Siga o painel', text: 'O painel de primeiros passos, no canto da tela, mostra o que falta.' },
]

export function renderWelcomeEmail(salonName: string, link: string) {
  const step = (s: (typeof STEPS)[number], i: number) => `<tr><td style="padding:0 0 14px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:22px;overflow:hidden;">
      <tr><td style="padding:0;line-height:0;font-size:0;"><img src="${IMG}/tela-${s.shot}.jpg" width="504" alt="Tela: ${escHtml(s.title)}" style="display:block;width:100%;height:auto;border:0;"></td></tr>
      <tr><td style="padding:18px 20px 22px;font-family:${FONT};">
        <span style="display:inline-block;padding:4px 12px;border-radius:999px;background-color:${INK};color:#ffffff;font-size:12px;font-weight:500;letter-spacing:1px;">PASSO ${i + 1}</span>
        <div style="padding-top:10px;font-size:24px;line-height:28px;font-weight:300;letter-spacing:-0.6px;color:${INK};">${escHtml(s.title)}</div>
        <div style="padding-top:6px;font-size:15px;line-height:23px;color:#0e0d0d;">${escHtml(s.text)}</div>
      </td></tr>
    </table>
  </td></tr>`
  const body = `${paragraph(`${salonName} já está no IKIZY. Falta pouco para as clientes pedirem horário sozinhas.`)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${LIGHT}" style="margin:4px 0 26px;background-color:${LIGHT};border-radius:26px;">
  <tr><td align="center" style="padding:26px 20px 28px;font-family:${FONT};">
    <div style="font-size:12px;line-height:16px;font-weight:500;letter-spacing:3px;color:${INK};">SEU TESTE COMEÇOU COM</div>
    <div class="num" style="padding:6px 0 0;font-size:104px;line-height:100px;font-weight:300;letter-spacing:-5px;color:${INK};">${TRIAL_DAYS}</div>
    <div style="font-size:26px;line-height:30px;font-weight:300;letter-spacing:-0.6px;color:${INK};">DIAS PARA TESTAR TUDO</div>
    <div style="padding-top:8px;font-size:14px;line-height:20px;color:${INK};">sem cadastrar cartão</div>
  </td></tr>
</table>
<div style="padding:0 0 14px;font-size:13px;line-height:16px;font-weight:500;letter-spacing:3px;color:${GREY};">PARA COMEÇAR A RECEBER CLIENTES</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${STEPS.map(step).join('')}</table>
<div style="padding:10px 0 0;">${button('Abrir minha agenda', link)}</div>`
  const footer = `Você recebeu este e-mail porque criou ${salonName} no IKIZY.`
  const html = renderShell({
    eyebrow: 'Bem-vinda',
    title: 'ao IKIZY',
    subtitle: 'Cadastro concluído.',
    preheader: `${salonName} já está no IKIZY, com ${TRIAL_DAYS} dias para testar tudo.`,
    body,
    footer,
  })
  const text = [
    `${salonName} já está no IKIZY, com ${TRIAL_DAYS} dias para testar tudo, sem cadastrar cartão.`,
    '',
    'Para começar a receber clientes:',
    ...STEPS.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`),
    '',
    `Abrir minha agenda: ${link}`,
    '',
    closingText(footer),
  ].join('\n')
  return { subject: `Boas-vindas ao IKIZY, ${salonName}`, html, text }
}

/** manda um e-mail uma vez só (chave no `email_log`); se o envio falhar, libera a chave para uma próxima tentativa */
async function sendOnce(deps: { db: NotifyDb; send: SendEmail }, key: string, owner: OwnerContact, template: string, mail: { subject: string; html: string; text: string }) {
  if (!owner.email) return false
  if (!(await deps.db.claim(key, owner.salonId, owner.email, template))) return false
  try {
    await deps.send({ to: owner.email, ...mail })
    return true
  } catch (error) {
    await deps.db.release(key)
    throw error
  }
}

/** avisa a dona de um pedido novo; erros só vão para o log (o pedido já foi gravado) */
export async function notifyNewRequest(deps: { db: NotifyDb; send: SendEmail; appUrl: string }, slug: string, r: NewRequest): Promise<boolean> {
  try {
    const owner = await deps.db.ownerBySlug(slug)
    if (!owner) return false
    const link = `${deps.appUrl}/dashboard/agenda?pedido=${encodeURIComponent(r.id)}`
    return await sendOnce(deps, `request:${r.id}`, owner, 'new_request', renderNewRequestEmail(owner.salonName, r, link))
  } catch (error) {
    reportError(error, `aviso de novo pedido ${slug}`)
    return false
  }
}

/** boas-vindas à dona, uma vez por negócio; erros só vão para o log */
export async function sendWelcome(deps: { db: NotifyDb; send: SendEmail; appUrl: string }, owner: OwnerContact): Promise<boolean> {
  try {
    return await sendOnce(deps, `welcome:${owner.salonId}`, owner, 'welcome', renderWelcomeEmail(owner.salonName, `${deps.appUrl}/dashboard`))
  } catch (error) {
    reportError(error, 'boas-vindas')
    return false
  }
}

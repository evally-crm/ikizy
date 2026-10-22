import { reportError } from './monitoring.js'
import { renderBrandEmail } from './emailLayout.js'
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

export function renderWelcomeEmail(salonName: string, link: string) {
  const mail = renderBrandEmail({
    title: 'Boas-vindas ao IKIZY',
    paragraphs: [
      `${salonName} já está no IKIZY, com 30 dias para testar tudo.`,
      'Para começar a receber clientes: confira o horário de atendimento, ajuste os preços dos serviços e publique o seu site. Depois, ligue o agendamento online para as clientes pedirem horário sozinhas.',
      'O painel de primeiros passos, no canto da tela, mostra o que falta.',
    ],
    button: 'Abrir minha agenda',
    link,
    footer: `Você recebeu este e-mail porque criou ${salonName} no IKIZY.`,
  })
  return { subject: `Boas-vindas ao IKIZY, ${salonName}`, ...mail }
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

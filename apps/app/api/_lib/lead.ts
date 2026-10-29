import { HttpError } from './billing.js'
import { renderBrandEmail } from './emailLayout.js'
import { reportError } from './monitoring.js'
import type { SendEmail } from './reminders.js'

/** e-mail deixado na landing: grava o contato e manda, uma vez só, um e-mail apresentando o IKIZY */

export interface LeadDb {
  /** true = passou do limite de tentativas nesse balde */
  limited(bucket: string, max: number, windowSeconds: number): Promise<boolean>
  /** grava o e-mail; false = já estava na lista (não manda o e-mail de novo) */
  save(email: string): Promise<boolean>
  /** marca que a apresentação saiu */
  welcomed(email: string): Promise<void>
}

export interface LeadInput {
  email: string
  /** campo escondido do formulário: só robô preenche */
  honeypot: boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function parseLeadInput(body: unknown): LeadInput {
  const b = (body ?? {}) as Record<string, unknown>
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  if (email.length > 254 || !EMAIL.test(email)) throw new HttpError(400, 'invalid_email', 'Confira o seu e-mail.')
  return { email, honeypot: typeof b.website === 'string' && b.website.trim() !== '' }
}

/** o e-mail de apresentação: curto, convidativo, com o teste grátis no botão */
export function leadWelcomeEmail(appUrl: string, trialDays: number) {
  const { html, text } = renderBrandEmail({
    title: 'Que bom ter você por aqui',
    subtitle: 'Seu teste grátis te espera.',
    paragraphs: [
      'Oi! Aqui é a IKIZY. Você deixou seu e-mail no nosso site, então vamos direto ao ponto: a gente cuida dos bastidores do seu negócio para você focar no que faz de melhor.',
      'Agenda online, ficha de cada cliente, lembretes prontos para o WhatsApp, caixa e comissões do mês e um site para as clientes pedirem horário sozinhas. Tudo num lugar só, direto no celular.',
      `Dá para testar tudo por ${trialDays} dias, sem cadastrar cartão. Em poucos minutos a sua agenda já está no ar.`,
    ],
    button: 'Começar meu teste grátis',
    link: `${appUrl}/cadastro?origem=email-lead`,
    footer: 'Você recebeu este e-mail porque deixou seu endereço em ikizy.com. Se não foi você, é só ignorar.',
  })
  return { subject: 'Sua rotina mais leve começa aqui', html, text }
}

export interface LeadDeps {
  db: LeadDb
  send: SendEmail
  appUrl: string
  trialDays: number
  /** quem recebe o aviso de cada contato novo (opcional) */
  notifyTo?: string
}

/** grava o lead e, se for novo, manda a apresentação; falha no envio não derruba o cadastro */
export async function captureLead(deps: LeadDeps, input: LeadInput, ip: string): Promise<void> {
  if (input.honeypot) return
  if (await deps.db.limited(`lead:ip:${ip}`, 5, 600)) throw new HttpError(429, 'too_many', 'Muitas tentativas. Aguarde alguns minutos.')
  const isNew = await deps.db.save(input.email)
  if (!isNew) return
  try {
    await deps.send({ to: input.email, ...leadWelcomeEmail(deps.appUrl, deps.trialDays) })
    await deps.db.welcomed(input.email)
  } catch (error) {
    reportError(error, 'lead-email')
  }
  if (!deps.notifyTo) return
  try {
    const mail = renderBrandEmail({
      title: 'Novo contato na landing',
      subtitle: 'Mais uma pessoa chegou.',
      paragraphs: ['Alguém deixou o e-mail no rodapé do site e já recebeu a apresentação do IKIZY.'],
      details: [['E-mail', input.email]],
      button: 'Abrir o IKIZY',
      link: deps.appUrl,
      footer: 'Você recebeu este aviso porque faz parte da equipe.',
    })
    await deps.send({ to: deps.notifyTo, subject: 'Novo contato na landing da IKIZY', ...mail })
  } catch (error) {
    reportError(error, 'lead-notify')
  }
}

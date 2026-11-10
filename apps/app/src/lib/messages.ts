/**
 * Mensagens prontas para o WhatsApp. Nada é enviado pelo sistema: o texto abre no WhatsApp da própria
 * pessoa (wa.me), que confere, ajusta e toca em enviar.
 */
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type MessageKind =
  | 'confirmacao'
  | 'recusa'
  | 'lembrete'
  | 'hoje'
  | 'pos'
  | 'falta'
  | 'manutencao'
  | 'sumida'
  | 'aniversario'
  | 'livre'

export const MESSAGE_LABEL: Record<MessageKind, string> = {
  confirmacao: 'Confirmar horário',
  recusa: 'Não vai dar',
  lembrete: 'Lembrete da véspera',
  hoje: 'Tudo certo para hoje?',
  pos: 'Pós-atendimento',
  falta: 'Faltou',
  manutencao: 'Hora da manutenção',
  sumida: 'Sentimos sua falta',
  aniversario: 'Aniversário',
  livre: 'Mensagem livre',
}

/** mensagens ligadas a um horário marcado */
export const APPOINTMENT_KINDS: MessageKind[] = ['confirmacao', 'recusa', 'lembrete', 'hoje', 'pos', 'falta']
/** mensagens de relacionamento com a cliente */
export const CLIENT_KINDS: MessageKind[] = ['manutencao', 'sumida', 'aniversario', 'livre']

export interface MessageContext {
  clientName: string
  salonName: string
  /** endereço do site do salão (para agendar) */
  siteUrl?: string
  /** endereço do salão; vai com link do mapa nas mensagens de horário marcado */
  address?: string
  service?: string
  /** nome de quem vai atender */
  professional?: string
  /** yyyy-MM-dd */
  date?: string
  /** minutos desde 00:00 */
  start?: number
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const day = (iso: string) => format(parseISO(iso), "EEEE, d 'de' MMMM", { locale: ptBR })

/** bloco com os dados do horário, um por linha, para a cliente bater o olho */
function details(service: string, when: string, professional?: string) {
  const lines = [`Serviço: ${service}`]
  if (professional?.trim()) lines.push(`Profissional: ${professional.trim()}`)
  if (when) lines.push(`📅 ${when}`)
  return lines.join('\n')
}

/** link do Google Maps (o mesmo do site): a cliente toca e abre a rota */
export function mapsUrl(salonName: string, address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salonName} ${address}`.trim())}`
}

/** endereço com link do mapa, no fim das mensagens de horário marcado; vazio sem endereço */
function location(salonName: string, address?: string) {
  const clean = address?.trim()
  return clean ? `\n\n📍 Endereço: ${clean}\n${mapsUrl(salonName, clean)}` : ''
}

/**
 * texto da mensagem; o salão pode editar antes de abrir o WhatsApp.
 * Tom cordial e direto, que serve para qualquer negócio e quem quer que envie: sem gênero de quem escreve
 * ("obrigada/obrigado"), sem promessa de brinde, data por extenso, pedido de resposta simples e poucos emojis.
 */
export function renderMessage(kind: MessageKind, ctx: MessageContext): string {
  const nome = firstName(ctx.clientName)
  const servico = ctx.service ?? 'seu atendimento'
  const hora = ctx.start !== undefined ? hhmm(ctx.start) : ''
  const quando = ctx.date ? `${day(ctx.date)}${hora ? `, às ${hora}` : ''}` : ''
  const horario = details(servico, quando, ctx.professional)
  const agendar = ctx.siteUrl ? `\n\nSe preferir, agende pelo link: ${ctx.siteUrl}` : ''
  const local = location(ctx.salonName, ctx.address)
  // o nome do negócio vai como assinatura: "no Studio" / "na Clínica" não tem como acertar sozinho
  const assinatura = ctx.salonName.trim() ? `\n\n${ctx.salonName.trim()}` : ''

  switch (kind) {
    case 'confirmacao':
      return `Olá, ${nome}! Tudo bem?\n\nSeu horário está reservado:\n\n${horario}\n\nPor favor, responda SIM para confirmar. Se precisar remarcar, é só avisar por aqui.${local}${assinatura}`
    case 'recusa':
      return `Olá, ${nome}! Tudo bem?\n\nRecebemos seu pedido de ${servico} para ${quando}, mas infelizmente esse horário não está disponível.\n\nResponda com os dias e períodos que ficam melhores para você, e encontramos outra opção.${agendar}${assinatura}`
    case 'lembrete':
      return `Olá, ${nome}! Tudo bem?\n\nPassando para lembrar do seu horário de amanhã:\n\n${horario}\n\nPodemos confirmar sua presença? É só responder SIM.\nCaso não possa comparecer, avise por aqui com antecedência para reagendarmos.${local}${assinatura}`
    case 'hoje':
      return `Olá, ${nome}! Seu horário é hoje, às ${hora}. Estamos à sua espera!\n\nSe surgir algum imprevisto, avise por aqui.${local}${assinatura}`
    case 'pos':
      return `Olá, ${nome}! Agradecemos pela visita hoje.\n\nEsperamos que tenha gostado do resultado. Se tiver qualquer dúvida sobre os cuidados em casa, é só chamar por aqui.\n\nSua opinião é muito importante: pode contar como foi a sua experiência?${assinatura}`
    case 'falta':
      return `Olá, ${nome}! Tudo bem?\n\nNotamos que você não conseguiu vir ao horário de hoje, às ${hora}. Se quiser, podemos reagendar: é só responder com o melhor dia para você.${agendar}${assinatura}`
    case 'manutencao':
      return `Olá, ${nome}! Tudo bem?\n\nEstá chegando o momento da sua manutenção. Quer reservar um horário? É só responder com o dia e o período de sua preferência.${agendar}${assinatura}`
    case 'sumida':
      return `Olá, ${nome}! Tudo bem?\n\nFaz um tempo desde a sua última visita. Quando quiser voltar, será um prazer atender você. É só responder por aqui para reservar um horário.${agendar}${assinatura}`
    case 'aniversario':
      return `Feliz aniversário, ${nome}! 🎉\n\nDesejamos a você um novo ano cheio de saúde, alegria e momentos especiais.${assinatura}`
    case 'livre':
      return `Olá, ${nome}! `
  }
}

/** link que abre o WhatsApp da pessoa (app ou web) com o texto pronto; null sem telefone */
export function whatsappHref(phone: string, text: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const number = digits.startsWith('55') && digits.length > 11 ? digits : `55${digits}`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

/** sugestão para um horário: pedido do site → confirmar, véspera → lembrete, hoje → tudo certo?, concluído → pós, falta → falta */
export function suggestForAppointment(status: string, date: string, today: string, tomorrow: string): MessageKind {
  // pedido que ainda não foi confirmado: a cliente precisa saber que o horário está garantido
  if (status === 'pendente') return 'confirmacao'
  if (status === 'concluido') return 'pos'
  if (status === 'faltou') return 'falta'
  // pedido recusado ou horário desmarcado pelo salão: avisar e oferecer outro
  if (status === 'cancelado') return 'recusa'
  if (date === today) return 'hoje'
  if (date === tomorrow) return 'lembrete'
  return 'confirmacao'
}

/* ---------------------------------------------------------------- "já mandei" */

// Lembrete de quem já recebeu a mensagem do dia. Fica neste navegador: é só para a lista não repetir.
const SENT_KEY = 'ikizy:mensagens-enviadas'

const readSent = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export const sentKey = (kind: MessageKind, id: string, dayKey: string) => `${dayKey}:${kind}:${id}`

export function wasSent(key: string) {
  return key in readSent()
}

export function markSent(key: string) {
  try {
    const all = readSent()
    all[key] = new Date().toISOString()
    // guarda só os últimos 30 dias
    const cutoff = format(new Date(Date.now() - 30 * 86_400_000), 'yyyy-MM-dd')
    for (const k of Object.keys(all)) if (k.slice(0, 10) < cutoff) delete all[k]
    localStorage.setItem(SENT_KEY, JSON.stringify(all))
  } catch {
    // sem armazenamento (aba anônima): a lista só não lembra
  }
}

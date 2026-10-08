/**
 * Mensagens prontas para o WhatsApp. Nada é enviado pelo sistema: o texto abre no WhatsApp da própria
 * pessoa (wa.me), que confere, ajusta e toca em enviar.
 */
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type MessageKind =
  | 'confirmacao'
  | 'lembrete'
  | 'hoje'
  | 'pos'
  | 'falta'
  | 'manutencao'
  | 'sumida'
  | 'aniversario'
  | 'premio'
  | 'livre'

export const MESSAGE_LABEL: Record<MessageKind, string> = {
  confirmacao: 'Confirmar horário',
  lembrete: 'Lembrete da véspera',
  hoje: 'Tudo certo para hoje?',
  pos: 'Pós-atendimento',
  falta: 'Faltou',
  manutencao: 'Hora da manutenção',
  sumida: 'Sentimos sua falta',
  aniversario: 'Aniversário',
  premio: 'Prêmio da fidelidade',
  livre: 'Mensagem livre',
}

/** mensagens ligadas a um horário marcado */
export const APPOINTMENT_KINDS: MessageKind[] = ['confirmacao', 'lembrete', 'hoje', 'pos', 'falta']
/** mensagens de relacionamento com a cliente */
export const CLIENT_KINDS: MessageKind[] = ['manutencao', 'sumida', 'aniversario', 'premio', 'livre']

export interface MessageContext {
  clientName: string
  salonName: string
  /** endereço do site do salão (para agendar) */
  siteUrl?: string
  service?: string
  /** yyyy-MM-dd */
  date?: string
  /** minutos desde 00:00 */
  start?: number
  /** nome do prêmio do cartão fidelidade */
  reward?: string
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const day = (iso: string) => format(parseISO(iso), "EEEE, d 'de' MMMM", { locale: ptBR })

/** texto da mensagem; o salão pode editar antes de abrir o WhatsApp */
export function renderMessage(kind: MessageKind, ctx: MessageContext): string {
  const nome = firstName(ctx.clientName)
  const salao = ctx.salonName || 'o salão'
  const servico = ctx.service ?? 'seu atendimento'
  const quando = ctx.date ? `${day(ctx.date)}${ctx.start !== undefined ? ` às ${hhmm(ctx.start)}` : ''}` : ''
  const hora = ctx.start !== undefined ? hhmm(ctx.start) : ''
  const agendar = ctx.siteUrl ? `\n\nPara agendar é só tocar aqui: ${ctx.siteUrl}` : ''

  switch (kind) {
    case 'confirmacao':
      return `Oi, ${nome}! Tudo bem? 😊\n\nSeu horário está marcado aqui no ${salao}:\n📅 ${quando}\n💅 ${servico}\n\nPode me confirmar se está tudo certo?`
    case 'lembrete':
      return `Oi, ${nome}! Passando para lembrar do seu horário amanhã:\n📅 ${quando}\n💅 ${servico}\n\nVocê confirma? Se precisar remarcar, é só me avisar por aqui. 💕`
    case 'hoje':
      return `Oi, ${nome}! Tudo certo para hoje às ${hora}? Já estamos te esperando aqui no ${salao}. ✨\n\nQualquer imprevisto, me avisa por aqui.`
    case 'pos':
      return `Oi, ${nome}! Obrigada por vir hoje. 💕\n\nEspero que tenha amado o resultado! Qualquer dúvida sobre os cuidados, é só me chamar.\n\nSe puder, me conta o que achou? Sua opinião me ajuda muito.`
    case 'falta':
      return `Oi, ${nome}! Senti sua falta hoje no horário das ${hora}. Aconteceu alguma coisa?\n\nSe quiser, já vejo um novo horário para você.`
    case 'manutencao':
      return `Oi, ${nome}! Já está chegando a hora da sua manutenção. 💅\n\nQuer que eu reserve um horário para você esta semana?${agendar}`
    case 'sumida':
      return `Oi, ${nome}! Faz um tempinho que você não vem e estou com saudade. 💕\n\nPreparei um carinho para a sua volta. Vamos marcar um horário?${agendar}`
    case 'aniversario':
      return `Feliz aniversário, ${nome}! 🎉🎂\n\nQue seu ano seja lindo. Para comemorar, tem um presente te esperando aqui no ${salao} no seu próximo atendimento. 💕`
    case 'premio':
      return `Oi, ${nome}! Você completou seu cartão fidelidade! 🎁\n\nSeu prêmio: ${(ctx.reward ?? 'um serviço grátis').toLowerCase()}. É só usar no seu próximo horário.${agendar}`
    case 'livre':
      return `Oi, ${nome}! `
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

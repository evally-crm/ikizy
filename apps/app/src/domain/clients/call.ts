import { addDays, format, isAfter } from 'date-fns'
import { MISSING_AFTER, daysSince, type TaggableClient } from './tags'

/** por que vale chamar a cliente hoje (o nome casa com a mensagem pronta do mesmo tipo) */
export type CallReason = { kind: 'aniversario' } | { kind: 'sumida'; days: number } | { kind: 'manutencao'; days: number }

export interface CallableClient extends TaggableClient {
  visits: number
  /** intervalo médio entre visitas, em dias */
  interval: number
  appointments: { status: string; date: Date }[]
}

/**
 * motivo para mandar mensagem hoje: aniversário hoje, sumida (mais de 45 dias sem vir) ou retorno atrasado
 * pelo intervalo dela. Para voltar, quem já tem horário marcado daqui para a frente não precisa ser chamada;
 * o parabéns vale sempre.
 */
export function callReason(c: CallableClient, today: Date): CallReason | null {
  if (c.birthday && c.birthday === format(today, 'MM-dd')) return { kind: 'aniversario' }
  const booked = c.appointments.some((a) => (a.status === 'pendente' || a.status === 'confirmado') && isAfter(a.date, today))
  if (booked || c.visits === 0) return null
  const days = daysSince(c.lastVisit, today)
  if (days > MISSING_AFTER) return { kind: 'sumida', days }
  const late = daysSince(addDays(c.lastVisit, c.interval), today)
  if (late > 0) return { kind: 'manutencao', days: late }
  return null
}

/** a frase curta da lista: "Aniversário hoje", "Sem vir há 60 dias", "Retorno atrasado 5 dias" */
export function callReasonLabel(r: CallReason): string {
  if (r.kind === 'aniversario') return 'Faz aniversário hoje 🎂'
  if (r.kind === 'sumida') return `Sem vir há ${r.days} dias`
  return r.days === 1 ? 'Retorno atrasado 1 dia' : `Retorno atrasado ${r.days} dias`
}

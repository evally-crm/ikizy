import { isAfter } from 'date-fns'
import { callReason, type CallableClient } from './call'
import { clientTags, type ClientTag } from './tags'

/** `chamar`: quem tem motivo para receber mensagem hoje (ver `callReason`) */
export type ClientFilter = 'todas' | 'chamar' | ClientTag

export const FILTERS: { id: ClientFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'chamar', label: 'Chamar hoje' },
  { id: 'vip', label: 'VIP' },
  { id: 'nova', label: 'Novas' },
  { id: 'sumida', label: 'Sumidas' },
  { id: 'aniversario', label: 'Aniversário' },
]

export interface BookClient extends CallableClient {
  id: string
  name: string
  phone: string
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** tem pedido (do site) esperando o salão confirmar */
export const awaitsConfirmation = (c: Pick<BookClient, 'appointments'>, today: Date) =>
  c.appointments.some((a) => a.status === 'pendente' && isAfter(a.date, today))

/**
 * a lista de contatos: filtra pela marcação e pela busca (nome sem acento ou telefone) e ordena
 * da visita mais recente para a mais antiga
 */
export function filterClients<T extends BookClient & { lastVisit: Date }>(clients: T[], query: string, filter: ClientFilter, today: Date): T[] {
  const q = fold(query.trim())
  const digits = q.replace(/\D/g, '')
  return clients
    .filter((c) => filter === 'todas' || (filter === 'chamar' ? callReason(c, today) !== null : clientTags(c, today).includes(filter)))
    .filter((c) => !q || fold(c.name).includes(q) || (digits !== '' && c.phone.replace(/\D/g, '').includes(digits)))
    .sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime())
}

/** quantas têm motivo para receber mensagem hoje (o número do filtro "Chamar hoje") */
export const countToCall = (clients: CallableClient[], today: Date) => clients.filter((c) => callReason(c, today) !== null).length

export interface BookSummary {
  active: number
  newOnes: number
  /** % das clientes com mais de uma visita */
  returningPct: number
  missing: number
}

/** os números do topo da tela de Clientes */
export function summarizeBook(clients: BookClient[], today: Date): BookSummary {
  const withTag = (tag: ClientTag) => clients.filter((c) => clientTags(c, today).includes(tag)).length
  return {
    active: clients.length,
    newOnes: withTag('nova'),
    returningPct: clients.length ? Math.round((clients.filter((c) => c.visits > 1).length / clients.length) * 100) : 0,
    missing: withTag('sumida'),
  }
}

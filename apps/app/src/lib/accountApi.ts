import { post } from './billingApi'

/** a dona recebe a data da exclusão (7 dias); quem é da equipe é apagado na hora */
export type DeleteResult = { deleted: true } | { scheduled: string }

/** pede a exclusão da conta; o servidor confere o texto digitado */
export async function deleteAccount(confirmation: string): Promise<DeleteResult> {
  return post<DeleteResult>('/api/account/delete', { confirmation })
}

/** a dona desiste da exclusão agendada */
export async function cancelDeletion(): Promise<void> {
  await post('/api/account/cancel-delete', {})
}

export interface AccountMe {
  admin: boolean
  /** quando a exclusão pedida acontece (null = nada agendado) */
  deletionAt: Date | null
}

/** quem está logada: é master da IKIZY? tem exclusão agendada? (sem servidor, ou com falha, é "não" e "nada") */
export async function fetchMe(): Promise<AccountMe> {
  try {
    const { admin, deletionAt } = await post<{ admin: boolean; deletionAt: string | null }>('/api/account/me', {})
    return { admin: admin === true, deletionAt: deletionAt ? new Date(deletionAt) : null }
  } catch {
    return { admin: false, deletionAt: null }
  }
}

export interface AdminSalon {
  id: string
  name: string
  slug: string
  createdAt: string
  ownerEmail: string | null
  ownerName: string | null
  plan: string | null
  status: string | null
  accessUntil: string | null
  method: string | null
  clients: number
  appointments: number
  members: number
  deletionScheduledAt: string | null
}

export interface AuditRow {
  id: number
  at: string
  actorKind: string
  actorEmail: string | null
  action: string
  salonName: string | null
  salonSlug: string | null
  details: Record<string, unknown>
}

export async function adminSalons(): Promise<AdminSalon[]> {
  const { salons } = await post<{ salons: AdminSalon[] }>('/api/account/admin-salons', {})
  return salons
}

export async function adminLog(): Promise<AuditRow[]> {
  const { log } = await post<{ log: AuditRow[] }>('/api/account/admin-log', {})
  return log
}

export async function adminDeleteSalon(salonId: string, confirmation: string): Promise<void> {
  await post('/api/account/admin-delete', { salonId, confirmation })
}

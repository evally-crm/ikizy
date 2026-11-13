import { post } from './billingApi'

/** apaga a conta: a dona leva junto o negócio inteiro e a assinatura; quem é da equipe só sai */
export async function deleteAccount(): Promise<void> {
  await post('/api/account/delete', { confirm: true })
}

/** quem está logada é master da IKIZY? (sem servidor, ou com falha, é sempre não) */
export async function fetchIsAdmin(): Promise<boolean> {
  try {
    const { admin } = await post<{ admin: boolean }>('/api/account/me', {})
    return admin === true
  } catch {
    return false
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
}

export async function adminSalons(): Promise<AdminSalon[]> {
  const { salons } = await post<{ salons: AdminSalon[] }>('/api/account/admin-salons', {})
  return salons
}

export async function adminDeleteSalon(salonId: string): Promise<void> {
  await post('/api/account/admin-delete', { salonId })
}

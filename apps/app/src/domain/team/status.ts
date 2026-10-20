import { expiresLabel } from './invite'
import type { Role } from './roles'

/** o pedaço da equipe que a regra precisa (o resto fica na camada de dados) */
export interface StatusProfessional {
  id: string
  userId: string | null
}
export interface StatusMember {
  userId: string
  role: Role
}
export interface StatusInvite {
  id: string
  professionalId: string | null
  expiresAt: Date
}

export type ProfessionalAccess =
  | { kind: 'member'; role: Role }
  | { kind: 'invite'; inviteId: string; label: string }
  | { kind: 'none' }

/** a profissional tem login, convite em aberto ou nada? (R-21: quem atende e quem tem login são coisas diferentes) */
export function professionalAccess(pro: StatusProfessional, members: StatusMember[], invites: StatusInvite[], now = new Date()): ProfessionalAccess {
  const member = pro.userId ? members.find((m) => m.userId === pro.userId) : undefined
  if (member) return { kind: 'member', role: member.role }
  const invite = invites.find((i) => i.professionalId === pro.id && i.expiresAt > now)
  if (invite) return { kind: 'invite', inviteId: invite.id, label: `Convite enviado · ${expiresLabel(invite.expiresAt, now)}` }
  return { kind: 'none' }
}

/** acessos que não atendem (recepção, gerente sem agenda) aparecem à parte da lista de profissionais */
export function membersWithoutAgenda<T extends StatusMember>(members: T[], professionals: StatusProfessional[]): T[] {
  const linked = new Set(professionals.map((p) => p.userId).filter(Boolean))
  return members.filter((m) => !linked.has(m.userId))
}

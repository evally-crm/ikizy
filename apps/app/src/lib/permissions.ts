import type { MemberRole } from '../auth/AuthProvider'

/**
 * O que cada papel vê no sistema. O banco garante o essencial (RLS): só dona/gerente leem o financeiro e
 * cadastram profissionais; só a dona mexe na equipe e na assinatura. Aqui é só o que aparece na tela.
 */
export type Area = 'finance' | 'site' | 'team' | 'billing'

const ACCESS: Record<MemberRole, Area[]> = {
  owner: ['finance', 'site', 'team', 'billing'],
  manager: ['finance', 'site', 'team'],
  reception: [],
  professional: [],
}

/** no modo demonstração (sem salão) tudo aparece */
export const can = (role: MemberRole | undefined, area: Area) => !role || ACCESS[role].includes(area)

/** só a dona convida, troca papéis e tira o acesso de alguém */
export const canManageMembers = (role: MemberRole | undefined) => !role || role === 'owner'

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Dona',
  manager: 'Gerente',
  reception: 'Recepção',
  professional: 'Profissional',
}

/** papéis que podem ser dados por convite, com o que cada um vê */
export const INVITE_ROLES: { id: Exclude<MemberRole, 'owner'>; label: string; text: string }[] = [
  { id: 'professional', label: 'Profissional', text: 'Vê a agenda e as clientes. Não vê o financeiro.' },
  { id: 'reception', label: 'Recepção', text: 'Marca e confirma horários e cuida das clientes. Não vê o financeiro.' },
  { id: 'manager', label: 'Gerente', text: 'Tudo do dia a dia, inclusive financeiro e site. Só não mexe na assinatura nem na equipe.' },
]

import type { PlanId } from '../../lib/plans'

export type Role = 'owner' | 'manager' | 'reception' | 'professional'

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Dona',
  manager: 'Gerente',
  reception: 'Recepção',
  professional: 'Profissional',
}

/** o que cada perfil enxerga, numa linha (tela de convite e lista de acessos) */
export const ROLE_HINT: Record<Role, string> = {
  owner: 'Tudo, inclusive a assinatura',
  manager: 'Tudo, menos a assinatura',
  reception: 'Agenda de todas, clientes e caixa do dia',
  professional: 'Só a própria agenda, as clientes dela e os ganhos',
}

/**
 * O que cada perfil vê no sistema (seção 4 do plano de experiência). A tela usa para esconder;
 * quem garante de verdade é o banco (migration 20261031000000_team).
 */
export interface RoleAccess {
  /** agenda e pedidos de todas as profissionais (profissional: só a dela) */
  agendaAll: boolean
  /** Financeiro: completo, só o caixa de hoje, ou nada */
  finance: 'full' | 'today' | 'none'
  /** quanto cada cliente já gastou */
  clientValues: boolean
  site: boolean
  business: boolean
  team: boolean
  billing: boolean
  /** "Meus ganhos": comissão do mês, só dela */
  earnings: boolean
}

export function roleAccess(role: Role): RoleAccess {
  switch (role) {
    case 'owner':
      return { agendaAll: true, finance: 'full', clientValues: true, site: true, business: true, team: true, billing: true, earnings: false }
    case 'manager':
      return { agendaAll: true, finance: 'full', clientValues: true, site: true, business: true, team: true, billing: false, earnings: false }
    case 'reception':
      return { agendaAll: true, finance: 'today', clientValues: false, site: false, business: false, team: false, billing: false, earnings: false }
    case 'professional':
      return { agendaAll: false, finance: 'none', clientValues: false, site: false, business: false, team: false, billing: false, earnings: true }
  }
}

/**
 * Perfis que dá para convidar (R-24): no Studio só profissionais; gerente e recepção são do Salão.
 * Gerente não convida gerente. O Solo não convida ninguém.
 */
export function invitableRoles(myRole: Role, plan: PlanId): Role[] {
  if (plan === 'solo' || (myRole !== 'owner' && myRole !== 'manager')) return []
  if (plan === 'studio') return ['professional']
  return myRole === 'owner' ? ['professional', 'reception', 'manager'] : ['professional', 'reception']
}

/** pode tirar o acesso ou trocar o perfil desta pessoa? (a dona é intocável; gerente não mexe em gerente) */
export function canManageMember(myRole: Role, target: Role, isMe: boolean): boolean {
  if (isMe || target === 'owner') return false
  if (myRole === 'owner') return true
  return myRole === 'manager' && target !== 'manager'
}

/**
 * Perfis para os quais dá para trocar um acesso: "profissional" só para quem está ligada a alguém da agenda
 * (senão não veria nada); gerente e recepção só no Salão; gerente só pela dona.
 */
export function assignableRoles(myRole: Role, plan: PlanId, linkedToAgenda: boolean): Role[] {
  const roles: Role[] = []
  if (linkedToAgenda) roles.push('professional')
  if (plan === 'salao') {
    roles.push('reception')
    if (myRole === 'owner') roles.push('manager')
  }
  return roles
}

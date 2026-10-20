import { CalendarDays, CreditCard, Globe, HandCoins, House, Store, Users, Wallet, type LucideIcon } from 'lucide-react'
import type { RoleAccess } from '../../domain/team'
import { dash, ROUTES } from '../../lib/routes'

export interface NavItem {
  to: string
  label: string
  /** nome curto da barra do celular (cabe embaixo do ícone) */
  short?: string
  icon: LucideIcon
  /** quem vê (sem isso, todos os perfis) */
  show?: (access: RoleAccess) => boolean
}

/**
 * seções principais: topo no computador; no celular, as quatro primeiras que o perfil vê ficam na barra e o resto vai
 * para as Configurações (avatar do topo). Profissional: Início, Agenda, Clientes e Ganhos. Recepção: Caixa no lugar de Ganhos.
 */
export const navItems: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Início', icon: House },
  { to: dash('/agenda'), label: 'Agenda', icon: CalendarDays },
  { to: dash('/clientes'), label: 'Clientes', icon: Users },
  { to: dash('/financeiro'), label: 'Financeiro', short: 'Caixa', icon: Wallet, show: (a) => a.finance !== 'none' },
  { to: dash('/ganhos'), label: 'Meus ganhos', short: 'Ganhos', icon: HandCoins, show: (a) => a.earnings },
  { to: dash('/site'), label: 'Meu site', icon: Globe, show: (a) => a.site },
  { to: dash('/negocio'), label: 'Meu negócio', icon: Store, show: (a) => a.business },
]

/** o que fica nas Configurações (celular) e no menu do avatar (computador), além do que já está no topo */
export const moreItems: NavItem[] = [{ to: dash('/assinatura'), label: 'Assinatura', icon: CreditCard, show: (a) => a.billing }]

/** itens que o perfil vê */
export const visibleFor = <T extends NavItem>(items: T[], access: RoleAccess) => items.filter((i) => !i.show || i.show(access))

/** o Início é a raiz: só fica marcado na própria raiz, as outras em qualquer subpágina */
export const isActive = (to: string, pathname: string) => (to === ROUTES.dashboard ? pathname === to : pathname.startsWith(to))

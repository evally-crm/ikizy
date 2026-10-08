import { CalendarDays, Globe, LayoutDashboard, UserRoundCog, Users, Wallet, type LucideIcon } from 'lucide-react'
import type { MemberRole } from '../../auth/AuthProvider'
import { dash, ROUTES } from '../../lib/routes'
import { can, type Area } from '../../lib/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** aparece direto no menu do topo (desktop); os demais ficam em "Mais" */
  core?: boolean
  /** aparece direto na barra inferior (celular) */
  primary?: boolean
  /** só aparece para quem tem acesso a esta área */
  area?: Area
}

/** só entram aqui as seções que já têm tela; as demais voltam quando forem criadas */
export const navItems: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Início', icon: LayoutDashboard, core: true, primary: true },
  { to: dash('/agenda'), label: 'Agenda', icon: CalendarDays, core: true, primary: true },
  { to: dash('/clientes'), label: 'Clientes', icon: Users, core: true, primary: true },
  { to: dash('/financeiro'), label: 'Financeiro', icon: Wallet, core: true, primary: true, area: 'finance' },
  { to: dash('/site'), label: 'Meu site', icon: Globe, core: true, primary: true, area: 'site' },
  { to: dash('/equipe'), label: 'Equipe', icon: UserRoundCog, core: true, area: 'team' },
]

export const navFor = (role: MemberRole | undefined) => navItems.filter((i) => !i.area || can(role, i.area))

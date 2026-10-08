import { CalendarDays, Globe, LayoutDashboard, Megaphone, Users, Wallet, type LucideIcon } from 'lucide-react'
import { dash, ROUTES } from '../../lib/routes'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** aparece direto no menu do topo (desktop); os demais ficam em "Mais" */
  core?: boolean
  /** aparece direto na barra inferior (celular) */
  primary?: boolean
}

/** só entram aqui as seções que já têm tela; as demais voltam quando forem criadas */
export const navItems: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Início', icon: LayoutDashboard, core: true, primary: true },
  { to: dash('/agenda'), label: 'Agenda', icon: CalendarDays, core: true, primary: true },
  { to: dash('/clientes'), label: 'Clientes', icon: Users, core: true, primary: true },
  { to: dash('/financeiro'), label: 'Financeiro', icon: Wallet, core: true, primary: true },
  { to: dash('/site'), label: 'Meu site', icon: Globe, core: true, primary: true },
  { to: dash('/campanhas'), label: 'Campanhas', icon: Megaphone },
]

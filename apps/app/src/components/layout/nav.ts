import {
  BarChart3,
  CalendarDays,
  Gift,
  Globe,
  LayoutDashboard,
  Megaphone,
  Package,
  Scissors,
  Settings,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
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

export const navItems: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Início', icon: LayoutDashboard, core: true, primary: true },
  { to: dash('/agenda'), label: 'Agenda', icon: CalendarDays, core: true, primary: true },
  { to: dash('/clientes'), label: 'Clientes', icon: Users, core: true, primary: true },
  { to: dash('/servicos'), label: 'Serviços', icon: Scissors, core: true },
  { to: dash('/financeiro'), label: 'Financeiro', icon: Wallet, core: true, primary: true },
  { to: dash('/equipe'), label: 'Equipe', icon: UserRound, core: true },
  { to: dash('/relatorios'), label: 'Relatórios', icon: BarChart3, core: true },
  { to: dash('/marketing'), label: 'Marketing', icon: Megaphone },
  { to: dash('/fidelidade'), label: 'Fidelidade', icon: Gift },
  { to: dash('/estoque'), label: 'Estoque', icon: Package },
  { to: dash('/site'), label: 'Meu site', icon: Globe },
  { to: dash('/configuracoes'), label: 'Configurações', icon: Settings },
]

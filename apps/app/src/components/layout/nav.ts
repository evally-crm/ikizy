import {
  CalendarDays,
  Gift,
  LayoutDashboard,
  Megaphone,
  Package,
  Scissors,
  Settings,
  UserRound,
  Users,
  Wallet,
  Globe,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** aparece direto na barra inferior (mobile) */
  primary?: boolean
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard, primary: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, primary: true },
  { to: '/clientes', label: 'Clientes', icon: Users, primary: true },
  { to: '/servicos', label: 'Serviços', icon: Scissors },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, primary: true },
  { to: '/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/fidelidade', label: 'Fidelidade', icon: Gift },
  { to: '/estoque', label: 'Estoque', icon: Package },
  { to: '/equipe', label: 'Equipe', icon: UserRound },
  { to: '/site', label: 'Meu site', icon: Globe },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

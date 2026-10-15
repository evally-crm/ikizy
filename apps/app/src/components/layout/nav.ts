import { CalendarDays, CreditCard, Globe, House, Store, Users, Wallet, type LucideIcon } from 'lucide-react'
import { dash, ROUTES } from '../../lib/routes'

export interface NavItem {
  to: string
  label: string
  /** nome curto da barra do celular (cabe embaixo do ícone) */
  short?: string
  icon: LucideIcon
}

/** seções principais: topo no computador; no celular, Início, Agenda, Clientes e Caixa ficam na barra e o resto vai para as Configurações (avatar do topo) */
export const navItems: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Início', icon: House },
  { to: dash('/agenda'), label: 'Agenda', icon: CalendarDays },
  { to: dash('/clientes'), label: 'Clientes', icon: Users },
  { to: dash('/financeiro'), label: 'Financeiro', short: 'Caixa', icon: Wallet },
  { to: dash('/site'), label: 'Meu site', icon: Globe },
  { to: dash('/negocio'), label: 'Meu negócio', icon: Store },
]

/** o que fica nas Configurações (celular) e no menu do avatar (computador), além do que já está no topo */
export const moreItems: (NavItem & { ownerOnly?: boolean })[] = [
  { to: dash('/assinatura'), label: 'Assinatura', icon: CreditCard, ownerOnly: true },
]

/** o Início é a raiz: só fica marcado na própria raiz, as outras em qualquer subpágina */
export const isActive = (to: string, pathname: string) => (to === ROUTES.dashboard ? pathname === to : pathname.startsWith(to))

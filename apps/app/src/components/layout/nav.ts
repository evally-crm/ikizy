import { CalendarDays, CreditCard, Globe, Store, Users, Wallet, type LucideIcon } from 'lucide-react'
import { dash, ROUTES } from '../../lib/routes'

export interface NavItem {
  to: string
  label: string
  /** nome curto da barra do celular (cabe embaixo do ícone) */
  short?: string
  icon: LucideIcon
}

/** seções principais: topo no computador; as duas primeiras e o Caixa também na barra do celular */
export const navItems: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Agenda', icon: CalendarDays },
  { to: dash('/clientes'), label: 'Clientes', icon: Users },
  { to: dash('/financeiro'), label: 'Financeiro', short: 'Caixa', icon: Wallet },
  { to: dash('/site'), label: 'Meu site', icon: Globe },
]

/** o que fica no menu "Mais" (celular) e no menu do avatar (computador) */
export const moreItems: (NavItem & { ownerOnly?: boolean })[] = [
  { to: dash('/negocio'), label: 'Meu negócio', icon: Store },
  { to: dash('/assinatura'), label: 'Assinatura', icon: CreditCard, ownerOnly: true },
]

/** a Agenda é a raiz: só fica marcada na própria raiz, as outras em qualquer subpágina */
export const isActive = (to: string, pathname: string) => (to === ROUTES.dashboard ? pathname === to : pathname.startsWith(to))

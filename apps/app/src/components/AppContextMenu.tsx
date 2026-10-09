import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarPlus, Copy, ExternalLink, Globe, KeyRound, Link2, LogIn, LogOut, RotateCw, Sparkles, UserPlus, UserRoundPlus } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useSalonInfo } from '../hooks/useSalonInfo'
import { dash, ROUTES } from '../lib/routes'
import { ContextMenu, type MenuEntry } from './ContextMenu'
import { navItems } from './layout/nav'

const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {})
const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

/** campos de texto continuam com o menu do navegador (colar, corretor etc.) */
const isEditable = (el: Element | null) =>
  !!el?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')

/**
 * botão direito em qualquer lugar do sistema abre o menu do IKIZY no lugar do menu do navegador.
 * Telas que têm menu próprio (ex.: atendimentos na agenda) chamam preventDefault e ficam com o delas.
 * Shift + botão direito mostra o menu do navegador.
 */
export function AppContextMenu() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { status, signOut } = useAuth()
  const { siteUrl } = useSalonInfo()
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)
  const close = useCallback(() => setMenu(null), [])

  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      if (e.defaultPrevented || e.shiftKey) return
      const target = e.target instanceof Element ? e.target : null
      if (isEditable(target)) return

      const entries: MenuEntry[] = []

      const selected = window.getSelection()?.toString().trim()
      if (selected) entries.push({ kind: 'item', label: 'Copiar', hint: 'C', icon: Copy, onSelect: () => copy(selected) })

      const href = target?.closest('a')?.href
      if (href) {
        entries.push(
          { kind: 'item', label: 'Abrir link em nova aba', icon: ExternalLink, onSelect: () => open(href) },
          { kind: 'item', label: 'Copiar endereço do link', icon: Link2, onSelect: () => copy(href) },
        )
      }
      if (entries.length) entries.push({ kind: 'sep' })

      if (pathname.startsWith(ROUTES.dashboard)) {
        entries.push(
          { kind: 'item', label: 'Novo agendamento', hint: 'N', icon: CalendarPlus, onSelect: () => navigate(dash('/agenda?nova=1')) },
          { kind: 'item', label: 'Nova cliente', hint: 'K', icon: UserRoundPlus, onSelect: () => navigate(dash('/clientes?nova=1')) },
          { kind: 'sep' },
        )
        navItems.forEach((item, i) =>
          entries.push({
            kind: 'item',
            label: item.label,
            hint: String(i + 1),
            icon: item.icon,
            checked: item.to === ROUTES.dashboard ? pathname === item.to : pathname.startsWith(item.to),
            onSelect: () => navigate(item.to),
          }),
        )
        entries.push({ kind: 'sep' })
        if (siteUrl) entries.push({ kind: 'item', label: 'Ver meu site no ar', icon: Globe, onSelect: () => open(siteUrl) })
      } else {
        entries.push(
          { kind: 'item', label: 'Entrar', icon: LogIn, checked: pathname === ROUTES.login, onSelect: () => navigate(ROUTES.login) },
          { kind: 'item', label: 'Criar conta', icon: UserPlus, checked: pathname === ROUTES.signup, onSelect: () => navigate(ROUTES.signup) },
          { kind: 'item', label: 'Esqueci minha senha', icon: KeyRound, onSelect: () => navigate(ROUTES.recover) },
          { kind: 'sep' },
          { kind: 'item', label: 'Conhecer o IKIZY', icon: Sparkles, onSelect: () => open('https://ikizy.com') },
        )
      }

      entries.push(
        { kind: 'item', label: 'Copiar link desta página', icon: Link2, onSelect: () => copy(window.location.href) },
        { kind: 'item', label: 'Recarregar', hint: 'R', icon: RotateCw, onSelect: () => window.location.reload() },
      )
      if (status === 'ready' || status === 'no-salon') {
        entries.push({ kind: 'sep' }, { kind: 'item', label: 'Sair', icon: LogOut, danger: true, onSelect: () => void signOut() })
      }

      e.preventDefault()
      // no próximo tick: o menu aberto também ouve este clique e se fecha, e o novo não pode ir junto
      const { clientX: x, clientY: y } = e
      setTimeout(() => setMenu({ x, y, entries }))
    }
    document.addEventListener('contextmenu', onMenu)
    return () => document.removeEventListener('contextmenu', onMenu)
  }, [pathname, navigate, siteUrl, status, signOut])

  return menu ? <ContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={close} /> : null
}

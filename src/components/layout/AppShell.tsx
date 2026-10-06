import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, ChevronDown, Ellipsis, Search, X } from 'lucide-react'
import { navItems } from './nav'
import { Avatar, Button } from '../ui'

const primary = navItems.filter((i) => i.primary)
const more = navItems.filter((i) => !i.primary)

function Logo() {
  return (
    <NavLink to="/" className="logo" aria-label="Evally — início">
      Evally<span className="logo__dot">.</span>
    </NavLink>
  )
}

function useCloseOn(open: boolean, close: () => void) {
  const { pathname } = useLocation()
  useEffect(() => close(), [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])
}

/** navegação em pílula (desktop) */
function PillNav() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const close = useRef(() => setOpen(false)).current
  useCloseOn(open, close)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const moreActive = more.some((i) => pathname.startsWith(i.to))

  return (
    <nav className="pillnav" aria-label="Navegação principal">
      {primary.map(({ to, label }) => (
        <NavLink key={to} to={to} end={to === '/'} className="pillnav__link">
          {label}
        </NavLink>
      ))}
      <div className="pillnav__more" ref={ref}>
        <button
          type="button"
          className={`pillnav__link ${moreActive ? 'active' : ''}`}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
        >
          Mais <ChevronDown size={14} aria-hidden="true" />
        </button>
        {open && (
          <div className="popover" role="menu">
            {more.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className="popover__item" role="menuitem">
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

/** barra flutuante (mobile/tablet) */
function BottomNav() {
  const [open, setOpen] = useState(false)
  const close = useRef(() => setOpen(false)).current
  useCloseOn(open, close)

  return (
    <>
      <nav className="bottomnav" aria-label="Navegação principal">
        {primary.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="bottomnav__link" aria-label={label} title={label}>
            <Icon size={20} aria-hidden="true" />
          </NavLink>
        ))}
        <button
          type="button"
          className="bottomnav__link"
          aria-label="Mais seções"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <Ellipsis size={20} aria-hidden="true" />
        </button>
      </nav>

      {open && (
        <div className="overlay" onClick={close}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Mais seções"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog__head">
              <h2>
                Mais <span className="em">seções</span>
              </h2>
              <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={close}>
                <X size={18} />
              </Button>
            </div>
            <div className="more-grid">
              {more.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className="more-grid__item">
                  <Icon size={20} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function AppShell() {
  return (
    <div className="shell">
      <div className="shell__orb" aria-hidden="true" />
      <header className="topbar">
        <div className="topbar__inner">
          <Logo />
          <PillNav />
          <div className="topbar__actions">
            <Button variant="soft" icon aria-label="Buscar" className="topbar__search">
              <Search size={18} />
            </Button>
            <Button variant="soft" icon aria-label="Notificações (3 novas)" className="notif">
              <Bell size={18} />
              <span className="notif__dot" aria-hidden="true" />
            </Button>
            <div className="user">
              <Avatar name="Maria Eduarda" />
              <div className="user__text">
                <p className="user__name">Maria Eduarda</p>
                <p className="user__role">Studio Maria Beauty</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

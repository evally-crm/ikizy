import { useEffect, useRef, useState, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, Ellipsis, LogOut, Search, X } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { SubscriptionProvider, useSubscription } from '../../billing/SubscriptionProvider'
import { AgendaProvider, useAgenda } from '../../data/AgendaProvider'
import { PendingDialog } from '../PendingRequests'
import BillingBanner from '../BillingBanner'
import { navFor } from './nav'
import { describeSubscription } from '../../lib/plans'
import { can, ROLE_LABEL } from '../../lib/permissions'
import { dash, ROUTES } from '../../lib/routes'
import { Avatar, Button } from '../ui'

/** seções que o papel de quem está logada pode ver */
function useNav() {
  const { salon } = useAuth()
  const items = navFor(salon?.role)
  return {
    // topo (desktop): as seções principais; o resto vai em 'Mais'
    topItems: items.filter((i) => i.core),
    topMore: items.filter((i) => !i.core),
    // barra inferior (celular)
    barItems: items.filter((i) => i.primary),
    barMore: items.filter((i) => !i.primary),
  }
}

function Logo() {
  return (
    <NavLink to={ROUTES.dashboard} className="logo" aria-label="IKIZY — início">
      IKIZY<span className="logo__dot">.</span>
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
  const { topItems, topMore } = useNav()
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

  const moreActive = topMore.some((i) => pathname.startsWith(i.to))

  return (
    <nav className="pillnav" aria-label="Navegação principal">
      {topItems.map(({ to, label }) => (
        <NavLink key={to} to={to} end={to === ROUTES.dashboard} className="pillnav__link">
          {label}
        </NavLink>
      ))}
      {topMore.length > 0 && (
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
            {topMore.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className="popover__item" role="menuitem">
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
      )}
    </nav>
  )
}

/** barra flutuante (mobile/tablet) */
function BottomNav() {
  const { barItems, barMore } = useNav()
  const [open, setOpen] = useState(false)
  const close = useRef(() => setOpen(false)).current
  useCloseOn(open, close)

  return (
    <>
      <nav className="bottomnav" aria-label="Navegação principal" style={{ gridTemplateColumns: `repeat(${barItems.length + (barMore.length > 0 ? 1 : 0)}, 1fr)` }}>
        {barItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === ROUTES.dashboard} className="bottomnav__link" aria-label={label} title={label}>
            <Icon size={20} aria-hidden="true" />
          </NavLink>
        ))}
        {barMore.length > 0 && (
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
        )}
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
              {barMore.map(({ to, label, icon: Icon }) => (
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

/** sininho: quantos pedidos online esperam confirmação; abre a lista para confirmar ou recusar */
function PendingBell() {
  const { pending } = useAgenda()
  const [open, setOpen] = useState(false)
  const count = pending.length

  // o número também aparece no título da aba, para quem deixa o sistema aberto no computador
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '')
    document.title = count > 0 ? `(${count}) ${base}` : base
  }, [count])

  return (
    <>
      <Button
        variant="soft"
        icon
        aria-label={count > 0 ? `Pedidos para confirmar (${count})` : 'Pedidos para confirmar'}
        title={count > 0 ? `${count} ${count === 1 ? 'pedido' : 'pedidos'} para confirmar` : 'Nenhum pedido esperando'}
        className="notif"
        onClick={() => setOpen(true)}
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="notif__count" aria-hidden="true">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>
      {open && <PendingDialog onClose={() => setOpen(false)} />}
    </>
  )
}

/** editar cadastro: nome da pessoa e do negócio */
function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { displayName, salon, session, updateProfile, signOut } = useAuth()
  const { sub } = useSubscription()
  const navigate = useNavigate()
  const [userName, setUserName] = useState(displayName)
  const [salonName, setSalonName] = useState(salon?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canEditSalon = !salon || salon.role === 'owner' || salon.role === 'manager'
  const seesBilling = can(salon?.role, 'billing')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const message = await updateProfile(userName, canEditSalon ? salonName : (salon?.name ?? salonName))
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Minha conta"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="dialog__head">
          <h2>
            Minha <span className="em">conta</span>
          </h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="form">
          <label className="field">
            <span className="field__label">Seu nome</span>
            <span className="input">
              <input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
              />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Nome do negócio</span>
            <span className="input">
              <input
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                autoComplete="organization"
                required
                minLength={2}
                maxLength={60}
                disabled={!canEditSalon}
              />
            </span>
            {!canEditSalon && <span className="field__hint">Só dona ou gerente altera o negócio.</span>}
          </label>
          {session?.user.email && (
            <label className="field">
              <span className="field__label">E-mail</span>
              <span className="input">
                <input value={session.user.email} disabled readOnly />
              </span>
            </label>
          )}
          {sub && seesBilling && (
            <div className="account-plan">
              <div>
                <span className="field__label">Assinatura</span>
                <p className="account-plan__text">{describeSubscription(sub)}</p>
              </div>
              <Button
                variant="light"
                size="sm"
                onClick={() => {
                  onClose()
                  navigate(dash('/assinatura'))
                }}
              >
                Ver planos
              </Button>
            </div>
          )}
          {salon && (
            <p className="field__hint">
              Seu endereço <strong>{salon.slug}</strong> não muda por aqui, para não quebrar links já compartilhados.
            </p>
          )}
        </div>

        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="dialog__actions">
          <Button variant="light" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
        {session && (
          <button type="button" className="dialog__signout" onClick={() => void signOut()}>
            <LogOut size={16} aria-hidden="true" /> Sair da conta
          </button>
        )}
      </form>
    </div>
  )
}

export default function AppShell() {
  const { salon, displayName } = useAuth()
  const [editing, setEditing] = useState(false)
  const closeEdit = useRef(() => setEditing(false)).current

  return (
    <SubscriptionProvider>
    <AgendaProvider>
    <div className="shell">
      <header className="topbar">
        <div className="topbar__inner">
          <Logo />
          <PillNav />
          <div className="topbar__actions">
            <label className="topsearch">
              <Search size={16} aria-hidden="true" />
              <input type="search" placeholder="Buscar cliente ou serviço" aria-label="Buscar" />
            </label>
            <PendingBell />
            <button type="button" className="user" aria-label="Editar cadastro" title="Editar cadastro" onClick={() => setEditing(true)}>
              <Avatar name={displayName} />
              <div className="user__text">
                <p className="user__name">{displayName}</p>
                <p className="user__role">
                  {salon?.name ?? 'Studio Maria Beauty'}
                  {salon && salon.role !== 'owner' && ` · ${ROLE_LABEL[salon.role]}`}
                </p>
              </div>
            </button>
          </div>
        </div>
      </header>
      <main className="content">
        <BillingBanner />
        <Outlet />
      </main>
      <BottomNav />
      {editing && <ProfileDialog onClose={closeEdit} />}
    </div>
    </AgendaProvider>
    </SubscriptionProvider>
  )
}

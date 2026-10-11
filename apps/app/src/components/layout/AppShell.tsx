import { useEffect, useRef, useState, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarPlus, Ellipsis, LogOut, Plus, Search, UserRound, X } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { SubscriptionProvider, useSubscription } from '../../billing/SubscriptionProvider'
import { AgendaProvider } from '../../data/AgendaProvider'
import BillingBanner from '../BillingBanner'
import { PendingBell, PendingToast } from '../PendingRequests'
import { isActive, moreItems, navItems, type NavItem } from './nav'
import { daysLeft, describeSubscription, isCardTrial, periodEnd } from '../../lib/plans'
import { agenda, dash, ROUTES } from '../../lib/routes'
import { Avatar, Button } from '../ui'

function Logo() {
  return (
    <NavLink to={ROUTES.dashboard} className="logo" aria-label="IKIZY — agenda">
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

/** itens do "Mais" que a pessoa pode ver (assinatura só para a dona) */
function useMoreItems() {
  const { salon } = useAuth()
  const isOwner = !salon || salon.role === 'owner'
  return moreItems.filter((i) => !i.ownerOnly || isOwner)
}

/** linha discreta do teste grátis, no menu do avatar e no "Mais" */
function TrialLine() {
  const { sub } = useSubscription()
  if (!sub || sub.status !== 'trialing') return null
  const days = daysLeft(isCardTrial(sub) ? periodEnd(sub) : sub.accessUntil)
  if (days <= 0) return null
  return (
    <NavLink to={dash('/assinatura')} className="trialline">
      Teste grátis · {days === 1 ? 'último dia' : `${days} dias`} <span>Ver planos</span>
    </NavLink>
  )
}

/** navegação em pílula (desktop) */
function PillNav() {
  return (
    <nav className="pillnav" aria-label="Navegação principal">
      {navItems.map(({ to, label }) => (
        <NavLink key={to} to={to} end={to === ROUTES.dashboard} className="pillnav__link">
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

/** avatar do topo (desktop): abre o menu da conta */
function UserMenu({ onAccount }: { onAccount: () => void }) {
  const { salon, displayName, signOut, status } = useAuth()
  const items = useMoreItems()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(() => setOpen(false)).current
  useCloseOn(open, close)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  return (
    <div className="usermenu" ref={ref}>
      <button type="button" className="user" aria-label="Menu da conta" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <Avatar name={displayName} />
        <div className="user__text">
          <p className="user__name">{displayName}</p>
          <p className="user__role">{salon?.name ?? 'Studio Maria Beauty'}</p>
        </div>
      </button>
      {open && (
        <div className="popover popover--list" role="menu">
          <TrialLine />
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="popover__item" role="menuitem">
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            className="popover__item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onAccount()
            }}
          >
            <UserRound size={18} aria-hidden="true" />
            Minha conta
          </button>
          {status !== 'demo' && (
            <button type="button" className="popover__item popover__item--muted" role="menuitem" onClick={() => void signOut()}>
              <LogOut size={18} aria-hidden="true" />
              Sair
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** barra flutuante (celular): Agenda, Clientes, [+], Caixa, Mais */
function BottomNav({ onAccount }: { onAccount: () => void }) {
  const { signOut, status } = useAuth()
  const items = useMoreItems()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const close = useRef(() => setOpen(false)).current
  useCloseOn(open, close)

  const [agendaItem, clientsItem, moneyItem, ...rest] = navItems
  const sheet = [...rest, ...items]
  const moreActive = sheet.some((i) => isActive(i.to, pathname))

  const link = ({ to, label, short, icon: Icon }: NavItem) => (
    <NavLink key={to} to={to} end={to === ROUTES.dashboard} className="bottomnav__link">
      <Icon size={20} aria-hidden="true" />
      <span>{short ?? label}</span>
    </NavLink>
  )

  return (
    <>
      <nav className="bottomnav" aria-label="Navegação principal">
        {link(agendaItem)}
        {link(clientsItem)}
        <button type="button" className="bottomnav__add" aria-label="Novo agendamento" onClick={() => navigate(agenda('nova=1'))}>
          <Plus size={24} aria-hidden="true" />
        </button>
        {link(moneyItem)}
        <button
          type="button"
          className={`bottomnav__link ${moreActive ? 'active' : ''}`}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <Ellipsis size={20} aria-hidden="true" />
          <span>Mais</span>
        </button>
      </nav>

      {open && (
        <div className="overlay" onClick={close}>
          <div className="dialog" role="dialog" aria-modal="true" aria-label="Mais" onClick={(e) => e.stopPropagation()}>
            <div className="dialog__head">
              <h2>
                Mais <span className="em">opções</span>
              </h2>
              <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={close}>
                <X size={18} />
              </Button>
            </div>
            <TrialLine />
            <div className="more-grid">
              {sheet.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className="more-grid__item">
                  <Icon size={20} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
              <button
                type="button"
                className="more-grid__item"
                onClick={() => {
                  close()
                  onAccount()
                }}
              >
                <UserRound size={20} aria-hidden="true" />
                Minha conta
              </button>
            </div>
            {status !== 'demo' && (
              <button type="button" className="dialog__signout" onClick={() => void signOut()}>
                <LogOut size={16} aria-hidden="true" /> Sair da conta
              </button>
            )}
          </div>
        </div>
      )}
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
          {sub && (
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
  const navigate = useNavigate()
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
            <Button className="topbar__add" onClick={() => navigate(agenda('nova=1'))}>
              <CalendarPlus size={16} aria-hidden="true" /> Agendar
            </Button>
            <UserMenu onAccount={() => setEditing(true)} />
          </div>
        </div>
      </header>
      <main className="content">
        <BillingBanner />
        <Outlet />
      </main>
      <BottomNav onAccount={() => setEditing(true)} />
      <PendingToast />
      {editing && <ProfileDialog onClose={closeEdit} />}
    </div>
    </AgendaProvider>
    </SubscriptionProvider>
  )
}

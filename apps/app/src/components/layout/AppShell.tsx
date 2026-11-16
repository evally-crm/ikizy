import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePresence } from '../../hooks/usePresence'
import { useAppTheme } from '../../lib/theme'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarPlus, ChevronRight, Clock, CreditCard, Globe, LogOut, Plus, ReceiptText, Scissors, ShieldCheck, UserPlus, UserRound, X, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { SubscriptionProvider, useSubscription } from '../../billing/SubscriptionProvider'
import { AgendaProvider } from '../../data/AgendaProvider'
import BillingBanner from '../BillingBanner'
import { FirstSteps } from '../FirstSteps'
import { PendingBell, PendingToast } from '../PendingRequests'
import { isActive, moreItems, navItems, visibleFor, type NavItem } from './nav'
import { roleAccess, type RoleAccess } from '../../domain/team'
import { daysLeft, describeSubscription, isCardTrial, periodEnd } from '../../lib/plans'
import { agenda, dash, ROUTES } from '../../lib/routes'
import { Avatar, Button, PageHeaderShell } from '../ui'
import { DarkModeRow } from '../DarkModeRow'
import { GlassDefs, useLiquidGlass } from '../ui/LiquidGlass'
import { useLensDrag } from '../ui/useLensDrag'
import { LogoWord } from '../BunnyMark'

function Logo() {
  return (
    <NavLink to={ROUTES.dashboard} className="logo" aria-label="IKIZY — início">
      <LogoWord />
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

/** o que o perfil de quem está logada vê (modo demonstração: tudo, como a dona) */
function useAccess(): RoleAccess {
  const { salon } = useAuth()
  return roleAccess(salon?.role ?? 'owner')
}

/** itens do "Mais" que a pessoa pode ver (assinatura só para a dona) */
function useMoreItems() {
  return visibleFor(moreItems, useAccess())
}

/** seções do perfil: as quatro primeiras vão para a barra do celular, o resto para as Configurações */
function useSections(): { all: NavItem[]; bar: NavItem[]; sheet: NavItem[] } {
  const all = visibleFor(navItems, useAccess())
  return { all, bar: all.slice(0, 4), sheet: all.slice(4) }
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
  const { all } = useSections()
  return (
    <nav className="pillnav" aria-label="Navegação principal">
      {all.map(({ to, label }) => (
        <NavLink key={to} to={to} end={to === ROUTES.dashboard} className="pillnav__link">
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

/** avatar do topo (desktop): abre o menu da conta */
function UserMenu() {
  const { salon, displayName, signOut, status, isAdmin } = useAuth()
  const items = useMoreItems()
  const [open, setOpen] = useState(false)
  const pop = usePresence(open)
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
      </button>
      {pop.mounted && (
        <div className={`popover popover--list ${pop.closing ? 'is-closing' : ''}`.trim()} role="menu">
          <div className="popover__who">
            <p className="user__name">{displayName}</p>
            <p className="user__role">{salon?.name ?? 'Studio Maria Beauty'}</p>
          </div>
          <TrialLine />
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="popover__item" role="menuitem">
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to={dash('/admin')} className="popover__item" role="menuitem">
              <ShieldCheck size={18} aria-hidden="true" />
              Master
            </NavLink>
          )}
          <DarkModeRow className="popover__item" />
          <NavLink to={dash('/conta')} className="popover__item" role="menuitem">
            <UserRound size={18} aria-hidden="true" />
            Minha conta
          </NavLink>
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

/** cartão escuro do plano nas Configurações: teste grátis ou plano atual, com atalho para a assinatura (só a dona) */
function PlanCard() {
  const { salon } = useAuth()
  const { sub } = useSubscription()
  const isOwner = !salon || salon.role === 'owner'
  if (!sub || !isOwner) return null
  const trialDays = sub.status === 'trialing' ? daysLeft(isCardTrial(sub) ? periodEnd(sub) : sub.accessUntil) : 0
  return (
    <NavLink to={dash('/assinatura')} className="plancard">
      <span className="plancard__icon">
        <CreditCard size={18} aria-hidden="true" />
      </span>
      <span className="plancard__text">
        <strong>{trialDays > 0 ? `Teste grátis · ${trialDays === 1 ? 'último dia' : `${trialDays} dias`}` : 'Seu plano'}</strong>
        <small>{trialDays > 0 ? 'Escolha um plano para seguir depois do teste, sem perder nada.' : describeSubscription(sub)}</small>
      </span>
      <span className="plancard__btn">
        {trialDays > 0 ? 'Ver planos' : 'Gerenciar'} <ChevronRight size={14} aria-hidden="true" />
      </span>
    </NavLink>
  )
}

/** atalhos do [+]: o que mais se cria no dia a dia (cada perfil vê só o que pode fazer) */
const QUICK: { to: string; label: string; icon: LucideIcon; show?: (a: RoleAccess) => boolean }[] = [
  { to: agenda('nova=1'), label: 'Agendamento', icon: CalendarPlus },
  { to: dash('/clientes?nova=1'), label: 'Cliente', icon: UserPlus },
  { to: dash('/financeiro?saida=1'), label: 'Saída', icon: ReceiptText, show: (a) => a.finance === 'full' },
  { to: dash('/negocio#servicos'), label: 'Serviços', icon: Scissors, show: (a) => a.business },
  { to: dash('/negocio#horario'), label: 'Horário', icon: Clock, show: (a) => a.business },
  { to: dash('/site'), label: 'Meu site', icon: Globe, show: (a) => a.site },
]

/** tempo da animação de fechar o painel do [+] (igual ao CSS) */
const QUICK_OUT_MS = 260

/** barra flutuante (celular): Início, Agenda, Clientes, Caixa e o [+]; o resto fica no avatar do topo */
function BottomNav() {
  const { bar: barItems } = useSections()
  const access = useAccess()
  const quickItems = QUICK.filter((q) => !q.show || q.show(access))
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = barItems.findIndex((i) => isActive(i.to, pathname))
  const lens = useLensDrag<HTMLDivElement>({ itemSelector: '.bottomnav__link', selected: active, onPick: (i) => navigate(barItems[i].to) })
  // vidro líquido: a lente (quando o dedo está nela), a própria barra e o [+] aberto entortam o que passa por trás
  const lensRef = useRef<HTMLSpanElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const lensGlass = useLiquidGlass(lensRef, { bezel: 10, thickness: 16, blur: 0.2, specular: 0.7 })
  const barGlass = useLiquidGlass(lens.ref, { bezel: 16, thickness: 14, blur: 6, saturation: 1.8, specular: 0.5, refraction: 0.8 })
  const addGlass = useLiquidGlass(addRef, { bezel: 14, thickness: 18, blur: 4, saturation: 1.8, specular: 0.6 })
  // painel do [+]: a barra se desfaz e vira a grade de atalhos; ao fechar, o caminho inverso
  const [quick, setQuick] = useState<'closed' | 'open' | 'closing'>('closed')
  const quickTimer = useRef<number | undefined>(undefined)
  const closeQuick = useCallback(() => {
    setQuick((q) => (q === 'open' ? 'closing' : q))
    window.clearTimeout(quickTimer.current)
    quickTimer.current = window.setTimeout(() => setQuick('closed'), QUICK_OUT_MS)
  }, [])
  useCloseOn(quick === 'open', closeQuick)
  useEffect(() => () => window.clearTimeout(quickTimer.current), [])
  const toggleQuick = () => {
    if (quick === 'open') closeQuick()
    else {
      window.clearTimeout(quickTimer.current)
      setQuick('open')
    }
  }

  return (
    <>
      {quick !== 'closed' && <div className={`quick-backdrop ${quick === 'closing' ? 'is-closing' : ''}`.trim()} aria-hidden="true" onClick={closeQuick} />}
      <nav className={`bottomnav ${quick !== 'closed' ? 'is-quick' : ''} ${quick === 'closing' ? 'is-closing' : ''}`.replace(/\s+/g, ' ').trim()} aria-label="Navegação principal">
        {quick !== 'closed' && (
          <div className="quick" id="quick-actions" role="menu" aria-label="Criar">
            {quickItems.map(({ to, label, icon: Icon }, i) => (
              <NavLink key={to} to={to} className="quick__item" role="menuitem" style={{ '--i': i } as CSSProperties} onClick={closeQuick}>
                <span className="quick__icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                {label}
              </NavLink>
            ))}
          </div>
        )}
        {/* pílula de vidro: só ícones; a lente marca a página atual e corre pela barra com o dedo. O + fica à parte, sólido */}
        {lensGlass.filter}
        {barGlass.filter}
        {addGlass.filter}
        <div
          ref={lens.ref}
          className={`bottomnav__bar ${lens.pressing ? 'is-pressing' : ''}`.trim()}
          style={barGlass.style}
          {...lens.handlers}
        >
          <span
            ref={lensRef}
            className={`bottomnav__lens ${lens.ready ? '' : 'is-hidden'}`.trim()}
            style={{ ...lens.lensStyle, ...lensGlass.style }}
            aria-hidden="true"
          />
          {barItems.map(({ to, label, short, icon: Icon }, i) => (
            <NavLink
              key={to}
              to={to}
              end={to === ROUTES.dashboard}
              className={`bottomnav__link ${i === lens.over ? 'is-lit' : ''}`.trim()}
              title={short ?? label}
              draggable={false}
            >
              <Icon size={22} aria-hidden="true" />
              <span className="bottomnav__label">{short ?? label}</span>
            </NavLink>
          ))}
        </div>
        <button
          ref={addRef}
          type="button"
          className="bottomnav__add"
          style={addGlass.style}
          aria-label={quick === 'open' ? 'Fechar atalhos' : 'Criar'}
          aria-expanded={quick === 'open'}
          aria-controls="quick-actions"
          onClick={toggleQuick}
        >
          <Plus size={24} aria-hidden="true" />
        </button>
      </nav>
    </>
  )
}

/** avatar ao lado do sininho (celular): abre as Configurações */
function SettingsButton({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const { displayName } = useAuth()
  const { pathname } = useLocation()
  const { sheet: sheetItems } = useSections()
  const more = useMoreItems()
  const active = [...sheetItems, ...more].some((i) => isActive(i.to, pathname))
  return (
    <button
      type="button"
      className={`user shellavatar ${active ? 'is-active' : ''}`.trim()}
      aria-label="Configurações"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <Avatar name={displayName} />
    </button>
  )
}

/** Configurações (celular): conta, plano, Meu site, Negócio, assinatura, modo escuro e sair */
function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut, status, displayName, salon, session, isAdmin } = useAuth()
  const items = useMoreItems()
  const { sheet: sheetItems } = useSections()
  const sheetIn = usePresence(open)
  useCloseOn(open, onClose)
  const sheet = [...sheetItems, ...items, ...(isAdmin ? [{ to: dash('/admin'), label: 'Master', icon: ShieldCheck }] : [])]

  if (!sheetIn.mounted) return null
  return (
    <div className={`overlay ${sheetIn.closing ? 'is-closing' : ''}`.trim()} onClick={onClose}>
      <div className="dialog dialog--settings" role="dialog" aria-modal="true" aria-label="Configurações" onClick={(e) => e.stopPropagation()}>
        <div className="settings__head">
          <h2 className="settings__title">Configurações</h2>
          <button type="button" className="settings__close" aria-label="Fechar" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <NavLink to={dash('/conta')} className="settings__profile">
          <Avatar name={displayName} />
          <span className="settings__who">
            <strong>{displayName}</strong>
            <small>{session?.user.email ?? salon?.name ?? 'Minha conta'}</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </NavLink>

        <PlanCard />

        <ul className="settings__list">
          {sheet.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} className="settings__row">
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
                <ChevronRight size={17} aria-hidden="true" />
              </NavLink>
            </li>
          ))}
        </ul>

        <ul className="settings__list">
          <li>
            <DarkModeRow />
          </li>
        </ul>

        {status !== 'demo' && (
          <ul className="settings__list">
            <li>
              <button type="button" className="settings__row settings__row--danger" onClick={() => void signOut()}>
                <LogOut size={19} aria-hidden="true" />
                <span>Sair da conta</span>
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}

export default function AppShell() {
  useAppTheme()
  const navigate = useNavigate()
  const [settings, setSettings] = useState(false)
  const closeSettings = useRef(() => setSettings(false)).current

  return (
    <SubscriptionProvider>
    <AgendaProvider>
    <div className="shell">
      <GlassDefs />
      <header className="topbar">
        <div className="topbar__inner">
          <Logo />
          <PillNav />
          <div className="topbar__actions">
            <PendingBell />
            <Button className="topbar__add" onClick={() => navigate(agenda('nova=1'))}>
              <CalendarPlus size={16} aria-hidden="true" /> Agendar
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="content">
        <BillingBanner />
        <PageHeaderShell.Provider
          value={
            <>
              <PendingBell />
              <SettingsButton open={settings} onOpen={() => setSettings(true)} />
            </>
          }
        >
          <Outlet />
        </PageHeaderShell.Provider>
      </main>
      <BottomNav />
      <SettingsSheet open={settings} onClose={closeSettings} />
      <PendingToast />
      <FirstSteps />
    </div>
    </AgendaProvider>
    </SubscriptionProvider>
  )
}

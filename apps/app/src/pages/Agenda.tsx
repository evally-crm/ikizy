import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDays, addMonths, endOfMonth, format, getDay, isSameDay, parseISO, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, LayoutGrid, List, Plus, RotateCcw } from 'lucide-react'
import { findConflict, useAgenda } from '../data/AgendaProvider'
import { useAuth } from '../auth/AuthProvider'
import { neon } from '../lib/neon'
import { useSubscription } from '../billing/SubscriptionProvider'
import { closedRanges, dayKey, gridWindow } from '../lib/agendaTime'
import { formatBRL, formatTime } from '../lib/format'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Avatar, Button, Card, StatusBadge } from '../components/ui'
import { AppointmentDialog, NewAppointmentDialog, whatsappLink, type NewInitial } from '../components/AppointmentDialogs'
import { appointmentEntries } from '../components/appointmentMenu'
import { ContextMenu, type MenuEntry } from '../components/ContextMenu'
import { ConfirmDialog } from '../components/Modal'
import { AppointmentMessageDialog } from '../components/MessageDialog'
import { WorkingHoursDialog } from '../components/WorkingHoursDialog'
import { PendingBanner } from '../components/PendingRequests'
import { DayAgenda } from '../components/DayAgenda'
import { TodayMessages } from '../components/TodayMessages'
import type { Appointment, AppointmentStatus } from '../types'

const HOUR_H = 72

const STATUS_NAME: Record<AppointmentStatus, string> = {
  pendente: 'aguardando',
  confirmado: 'confirmado',
  atendimento: 'em atendimento',
  concluido: 'concluído',
  cancelado: 'cancelado',
  faltou: 'falta',
}

/** no Solo quem atende é a própria dona: a agenda já nasce com ela, sem perguntar nada */
function SoloProfessional() {
  const { addProfessional, reload } = useAgenda()
  const { displayName, session, salon } = useAuth()
  const salonId = salon?.id
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const create = useCallback(async () => {
    setError(null)
    // nunca cadastra uma segunda: se o negócio já tem profissional (a lista local pode estar atrasada), só recarrega
    if (neon && salonId) {
      const { data } = await neon.from('professionals').select('id').eq('salon_id', salonId).limit(1)
      if (data && data.length > 0) {
        reload()
        return
      }
    }
    setError(await addProfessional(displayName, '', session?.user.id))
  }, [addProfessional, reload, displayName, session, salonId])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void create()
  }, [create])

  return (
    <Card className="agenda__empty">
      {error ? (
        <>
          <h2 className="card__title">Não deu para preparar sua agenda</h2>
          <p className="dialog__error" role="alert">
            {error}
          </p>
          <Button onClick={() => void create()}>Tentar de novo</Button>
        </>
      ) : (
        <p className="card__sub" role="status">
          Preparando sua agenda…
        </p>
      )}
    </Card>
  )
}

/** planos com equipe: a agenda é organizada por profissional, então a primeira é cadastrada aqui */
function FirstProfessional() {
  const { addProfessional } = useAgenda()
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const message = await addProfessional(name, title)
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <Card className="agenda__empty">
      <h2 className="card__title">Cadastre quem atende</h2>
      <p className="card__sub">A agenda é organizada por profissional. Comece com a primeira; as outras entram depois.</p>
      <form className="form" onSubmit={onSubmit}>
        <div className="form__pair">
          <label className="field">
            <span className="field__label">Nome</span>
            <span className="input">
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Especialidade (opcional)</span>
            <span className="input">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Nail designer" maxLength={60} />
            </span>
          </label>
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Adicionar profissional'}
        </Button>
      </form>
    </Card>
  )
}

type View = 'semana' | 'mes'

/** cartão de calendário: título grande, semana em arco centrada no dia escolhido ou grade do mês */
function CalendarCard({
  date,
  now,
  view,
  counts,
  summary,
  canCreate,
  side,
  onView,
  onDate,
  onNew,
}: {
  date: Date
  now: Date
  view: View
  counts: Map<string, number>
  summary: string
  canCreate: boolean
  /** no desktop o cartão vira a coluna lateral: sempre o mês, sem alternador */
  side?: boolean
  onView: (v: View) => void
  onDate: (d: Date) => void
  onNew: () => void
}) {
  if (side) view = 'mes'
  const monthName = format(date, 'MMMM', { locale: ptBR })
  const step = (d: Date, n: number) => (view === 'mes' ? addMonths(d, n) : addDays(d, n * 7))

  const arc = Array.from({ length: 7 }, (_, i) => addDays(date, i - 3))

  const first = startOfMonth(date)
  const blanks = (getDay(first) + 6) % 7
  const monthDays = Array.from({ length: endOfMonth(date).getDate() }, (_, i) => addDays(first, i))

  return (
    <section className={`calcard ${side ? 'calcard--flat' : ''}`} aria-label="Calendário">
      <div className="calcard__top">
        {side ? (
          <h2 className="calcard__month">
            {monthName[0].toUpperCase() + monthName.slice(1)} <span>{format(date, 'yyyy')}</span>
          </h2>
        ) : (
          <div className="seg" role="tablist" aria-label="Visualização">
            <button type="button" role="tab" aria-selected={view === 'semana'} onClick={() => onView('semana')}>
              Semana
            </button>
            <button type="button" role="tab" aria-selected={view === 'mes'} onClick={() => onView('mes')}>
              Mês
            </button>
          </div>
        )}
        <div className="calcard__nav">
          <button type="button" aria-label={view === 'mes' ? 'Mês anterior' : 'Semana anterior'} onClick={() => onDate(step(date, -1))}>
            <ChevronLeft size={18} />
          </button>
          {side ? (
            <button type="button" className="calcard__today" onClick={() => onDate(new Date())}>
              Hoje
            </button>
          ) : (
            <button type="button" aria-label="Voltar para hoje" title="Hoje" onClick={() => onDate(new Date())}>
              <RotateCcw size={16} />
            </button>
          )}
          <button type="button" aria-label={view === 'mes' ? 'Próximo mês' : 'Próxima semana'} onClick={() => onDate(step(date, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {side ? (
        <h1 className="sr-only">Agenda</h1>
      ) : (
        <h1 className="calcard__title">
          <span>{monthName[0].toUpperCase() + monthName.slice(1)}</span>
          <span className="calcard__day">{format(date, 'd')}</span>
        </h1>
      )}

      {view === 'semana' ? (
        <div className="arc" role="tablist" aria-label="Dias da semana">
          {arc.map((d, i) => {
            const dist = Math.abs(i - 3)
            const n = counts.get(dayKey(d)) ?? 0
            return (
              <button
                key={d.toISOString()}
                type="button"
                role="tab"
                aria-selected={i === 3}
                className={`arc__day ${isSameDay(d, now) ? 'is-today' : ''}`}
                style={{ transform: `translateY(${dist * dist * 3}px)`, opacity: 1 - dist * 0.17 }}
                onClick={() => onDate(d)}
                aria-label={`${format(d, "EEEE, d 'de' MMMM", { locale: ptBR })}${n ? `, ${n} atendimentos` : ''}`}
              >
                <span className="arc__name">{format(d, 'EEEE', { locale: ptBR }).slice(0, 3)}</span>
                <span className="arc__num">{format(d, 'd')}</span>
                <span className={`arc__dot ${n ? 'is-on' : ''}`} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="monthgrid">
          {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((w) => (
            <span key={w} className="monthgrid__head">
              {w}
            </span>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {monthDays.map((d) => {
            const n = counts.get(dayKey(d)) ?? 0
            return (
              <button
                key={d.toISOString()}
                type="button"
                className={`monthgrid__day ${isSameDay(d, date) ? 'is-selected' : ''} ${isSameDay(d, now) ? 'is-today' : ''}`}
                onClick={() => {
                  onDate(d)
                  if (!side) onView('semana')
                }}
                aria-label={`${format(d, "d 'de' MMMM", { locale: ptBR })}${n ? `, ${n} atendimentos` : ''}`}
              >
                <span className="monthgrid__num">{format(d, 'd')}</span>
                <span className={`arc__dot ${n ? 'is-on' : ''}`} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      )}

      {!side && (
        <div className="calcard__foot">
          <span className="calcard__summary">{summary}</span>
          <button type="button" className="calcard__new" disabled={!canCreate} onClick={onNew}>
            <Plus size={15} aria-hidden="true" /> Novo agendamento
          </button>
        </div>
      )}
    </section>
  )
}

/** desktop: atendimentos do dia selecionado, ao lado do calendário */
function DayList({
  date,
  items,
  professionals,
  loading,
  canCreate,
  onOpen,
  onMenu,
  onNew,
}: {
  date: Date
  items: Appointment[]
  professionals: { id: string; name: string }[]
  loading: boolean
  canCreate: boolean
  onOpen: (id: string) => void
  onMenu: (e: React.MouseEvent, a: Appointment) => void
  onNew: () => void
}) {
  const sorted = [...items].sort((a, b) => a.start - b.start)
  const proName = (id: string) => professionals.find((p) => p.id === id)?.name ?? ''
  return (
    <section className="evcard" aria-label="Atendimentos do dia">
      <div className="evcard__head">
        <h2 className="evcard__title">
          Atendimentos <span>{format(date, "d 'de' MMM", { locale: ptBR }).replace('.', '')}</span>
        </h2>
        <button type="button" className="evcard__new" disabled={!canCreate} onClick={onNew}>
          <Plus size={15} aria-hidden="true" /> Novo
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="evcard__empty">
          {loading ? 'Carregando…' : 'Nenhum atendimento neste dia.'}
          {!loading && <span>Clique em "Novo" ou num horário da grade para agendar.</span>}
        </p>
      ) : (
        <ul className="evcard__list">
          {sorted.map((a) => (
            <li key={a.id}>
              <button type="button" className="ev" onClick={() => onOpen(a.id)} onContextMenu={(e) => onMenu(e, a)}>
                <span className="ev__time">
                  <strong>{formatTime(a.start)}</strong>
                  <span>{a.duration} min</span>
                </span>
                <span className="ev__body">
                  <span className="ev__top">
                    <span className="ev__name">{a.client}</span>
                    <StatusBadge status={a.status} />
                  </span>
                  <span className="ev__meta">
                    {a.service} · {proName(a.professionalId)} · {formatBRL(a.price)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function Agenda() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isDesktop = useMediaQuery('(min-width: 1100px)')
  const { professionals, appointments, pending, workingHours, loading, error, focus, reload, update } = useAgenda()
  const [params, setParams] = useSearchParams()
  const { sub, loading: subLoading } = useSubscription()
  const [editingHours, setEditingHours] = useState(false)
  const [date, setDate] = useState(() => new Date())
  const [proFilter, setProFilter] = useState<string>('all')
  const [dialog, setDialog] = useState<{ id: string; reschedule: boolean } | null>(null)
  const [creating, setCreating] = useState<NewInitial | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)
  const [confirm, setConfirm] = useState<Appointment | null>(null)
  const [messaging, setMessaging] = useState<Appointment | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useState<View>('semana')
  // celular e tablet: lista do dia (padrão) ou grade; a escolha fica guardada neste aparelho
  const [mode, setMode] = useState<'lista' | 'grade'>(() => {
    try {
      return localStorage.getItem('ikizy:agenda-modo') === 'grade' ? 'grade' : 'lista'
    } catch {
      return 'lista'
    }
  })
  const chooseMode = (m: 'lista' | 'grade') => {
    setMode(m)
    try {
      localStorage.setItem('ikizy:agenda-modo', m)
    } catch {
      // sem armazenamento: vale só nesta visita
    }
  }
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => focus(date), [date, focus])

  // no computador a lista do dia fica ao lado da grade; abaixo disso, lista ou grade
  const listMode = !isDesktop && mode === 'lista'
  // na grade do celular cabe uma profissional por vez; na lista cabem todas
  const activePro = isMobile && !listMode && proFilter === 'all' ? (professionals[0]?.id ?? 'all') : proFilter
  const visiblePros = activePro === 'all' ? professionals : professionals.filter((p) => p.id === activePro)
  const selected = dialog ? (appointments.find((a) => a.id === dialog.id) ?? null) : null

  const today = dayKey(date)
  const dayAppointments = appointments.filter((a) => a.date === today && a.status !== 'cancelado')
  const countByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of appointments) if (a.status !== 'cancelado') map.set(a.date, (map.get(a.date) ?? 0) + 1)
    return map
  }, [appointments])

  // a grade vai do horário de atendimento cadastrado (não mais 8h–20h fixo)
  const { startHour, endHour } = useMemo(
    () => gridWindow(visiblePros.map((p) => workingHours[p.id] ?? []), dayAppointments),
    [visiblePros, workingHours, dayAppointments],
  )
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const toY = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_H

  const isToday = isSameDay(date, now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const showNow = isToday && nowMinutes >= startHour * 60 && nowMinutes < endHour * 60
  const gridHeight = hours.length * HOUR_H

  // no desktop a grade rola por dentro: abre perto do horário atual (ou do primeiro atendimento)
  const scrollRef = useRef<HTMLDivElement>(null)
  const firstStart = dayAppointments.reduce((m, a) => Math.min(m, a.start), Infinity)
  const anchor = isToday ? nowMinutes : firstStart
  const hasAnchor = Number.isFinite(anchor)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !hasAnchor) return
    el.scrollTop = Math.max(0, toY(anchor) - HOUR_H)
  }, [today, hasAnchor, isDesktop]) // eslint-disable-line react-hooks/exhaustive-deps

  const notify = useCallback((message: string) => setToast(message), [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])
  const closeMenu = useCallback(() => setMenu(null), [])

  // /dashboard/agenda?horarios=1 abre o horário de atendimento (atalho do Meu site)
  useEffect(() => {
    if (params.get('horarios') !== '1') return
    setEditingHours(true)
    setParams({}, { replace: true })
  }, [params, setParams])

  // /dashboard/agenda?nova=1&cliente=Nome abre um agendamento novo já com a cliente (atalho da ficha)
  useEffect(() => {
    if (params.get('nova') !== '1' || loading) return
    setCreating({ date: dayKey(new Date()), start: null, clientName: params.get('cliente') ?? undefined })
    setParams({}, { replace: true })
  }, [params, setParams, loading])

  const openRequest = (a: Appointment) => {
    setDate(parseISO(a.date))
    setDialog({ id: a.id, reschedule: false })
  }

  // /dashboard/agenda?pedido=id (sininho, Início): vai até o dia do pedido e abre o atendimento
  useEffect(() => {
    const id = params.get('pedido')
    if (!id || pending === null) return
    const a = pending.find((x) => x.id === id) ?? appointments.find((x) => x.id === id)
    if (a) openRequest(a)
    setParams({}, { replace: true })
  }, [params, setParams, pending]) // eslint-disable-line react-hooks/exhaustive-deps

  const newNow = () => setCreating({ date: today, start: null })

  /** minuto do dia sob o cursor na coluna, de 15 em 15 */
  const minuteAt = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return startHour * 60 + Math.floor(((e.clientY - rect.top) / HOUR_H) * 4) * 15
  }
  const onBackground = (e: React.MouseEvent<HTMLDivElement>) =>
    e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('agenda__line')

  const openSlot = (e: React.MouseEvent<HTMLDivElement>, professionalId: string) => {
    if (!onBackground(e)) return
    setCreating({ date: today, start: minuteAt(e), professionalId })
  }

  const slotMenu = (e: React.MouseEvent<HTMLDivElement>, professionalId: string) => {
    if (!onBackground(e)) return
    e.preventDefault()
    const minutes = minuteAt(e)
    setMenu({
      x: e.clientX,
      y: e.clientY,
      entries: [
        {
          kind: 'item',
          label: `Novo agendamento às ${formatTime(minutes)}`,
          hint: 'N',
          icon: CalendarPlus,
          disabled: professionals.length === 0,
          onSelect: () => setCreating({ date: today, start: minutes, professionalId }),
        },
        { kind: 'item', label: 'Ir para hoje', hint: 'H', icon: RotateCcw, onSelect: () => setDate(new Date()) },
      ],
    })
  }

  const patch = async (a: Appointment, changes: Parameters<typeof update>[1], ok: string) => {
    const message = await update(a.id, changes)
    notify(message ?? ok)
  }

  /** botão do momento na lista: confirmar e iniciar são diretos; concluir abre o atendimento (pede a forma de pagamento) */
  const advance = async (a: Appointment) => {
    if (a.status === 'pendente') {
      const message = await update(a.id, { status: 'confirmado' })
      if (message) return notify(message)
      notify(`${a.client}: confirmado`)
      // a cliente precisa saber: já abre a mensagem pronta de confirmação
      if (a.phone.replace(/\D/g, '')) setMessaging({ ...a, status: 'confirmado' })
    } else if (a.status === 'confirmado') void patch(a, { status: 'atendimento' }, `${a.client}: em atendimento`)
    else setDialog({ id: a.id, reschedule: false })
  }

  const duplicate = (a: Appointment) =>
    setCreating({ date: a.date, start: null, professionalId: a.professionalId, clientName: a.client, serviceId: a.serviceId ?? undefined })

  const appointmentMenu = (e: React.MouseEvent, a: Appointment) => {
    e.preventDefault()
    e.stopPropagation()
    const link = whatsappLink(a)
    setMenu({
      x: e.clientX,
      y: e.clientY,
      entries: appointmentEntries(
        a,
        professionals,
        {
          status: (st) => void patch(a, { status: st }, `${a.client}: ${STATUS_NAME[st]}`),
          professional: (id) => {
            const name = professionals.find((p) => p.id === id)?.name ?? ''
            const clash = findConflict(appointments, { professionalId: id, date: a.date, start: a.start, duration: a.duration }, a.id)
            if (clash) notify(`${name} já tem ${clash.client} nesse horário`)
            else void patch(a, { professionalId: id }, `${a.client} agora com ${name}`)
          },
          reschedule: () => setDialog({ id: a.id, reschedule: true }),
          whatsapp: () => setMessaging(a),
          duplicate: () => duplicate(a),
          fault: () => void patch(a, { status: 'faltou' }, `Falta registrada: ${a.client}`),
          cancel: () => setConfirm(a),
        },
        Boolean(link),
      ),
    })
  }

  return (
    <div className="page agendapage">
      <div className="agendapage__side">
        <CalendarCard
          side={isDesktop}
          date={date}
          now={now}
          view={view}
          counts={countByDay}
          summary={
            loading
              ? 'Carregando…'
              : dayAppointments.length === 0
                ? 'Nenhum atendimento neste dia'
                : `${dayAppointments.length} ${dayAppointments.length === 1 ? 'atendimento' : 'atendimentos'} em ${format(date, "d 'de' MMMM", { locale: ptBR })}`
          }
          canCreate={professionals.length > 0}
          onView={setView}
          onDate={setDate}
          onNew={newNow}
        />

        {isDesktop && (
          <DayList
            date={date}
            items={dayAppointments}
            professionals={professionals}
            loading={loading}
            canCreate={professionals.length > 0}
            onOpen={(id) => setDialog({ id, reschedule: false })}
            onMenu={appointmentMenu}
            onNew={newNow}
          />
        )}
        {isDesktop && <TodayMessages clientsOnly />}
      </div>

      <div className="agendapage__main">
        {error && (
          <p className="dialog__error" role="alert">
            {error}{' '}
            <button type="button" className="textlink" onClick={reload}>
              Tentar de novo
            </button>
          </p>
        )}

        {!loading && professionals.length === 0 && !error ? (
          subLoading ? null : sub && sub.plan !== 'solo' ? <FirstProfessional /> : <SoloProfessional />
        ) : (
          <>
            <PendingBanner
              onOpen={(id) => {
                const a = pending?.find((x) => x.id === id)
                if (a) openRequest(a)
              }}
              notify={notify}
              collapsed={!isDesktop}
            />
            <div className={`chips ${isDesktop ? '' : 'chips--scroll'}`} role="group" aria-label="Filtrar por profissional">
              {!isDesktop && (
                <div className="seg seg--icons" role="tablist" aria-label="Visualização do dia">
                  <button type="button" role="tab" aria-selected={listMode} aria-label="Lista" title="Lista" onClick={() => chooseMode('lista')}>
                    <List size={16} aria-hidden="true" />
                  </button>
                  <button type="button" role="tab" aria-selected={!listMode} aria-label="Grade" title="Grade" onClick={() => chooseMode('grade')}>
                    <LayoutGrid size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
              {(!isMobile || listMode) && professionals.length > 1 && (
                <button type="button" className="chip" aria-pressed={activePro === 'all'} onClick={() => setProFilter('all')}>
                  Todas
                </button>
              )}
              {professionals.length > 1 && professionals.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  aria-pressed={activePro === p.id}
                  onClick={() => setProFilter(p.id)}
                >
                  {p.name}
                </button>
              ))}
              {!isMobile && (
                <button type="button" className="chip chip--ghost" onClick={() => setEditingHours(true)}>
                  <Clock size={14} aria-hidden="true" /> Horário de atendimento
                </button>
              )}
            </div>

            {listMode ? (
              <>
                <DayAgenda
                  items={visiblePros.length === professionals.length ? dayAppointments : dayAppointments.filter((x) => visiblePros.some((p) => p.id === x.professionalId))}
                  professionals={professionals}
                  showPro={visiblePros.length > 1}
                  hours={visiblePros.length === 1 ? workingHours[visiblePros[0].id] : undefined}
                  weekday={date.getDay()}
                  isToday={isToday}
                  isPast={!isToday && date < now}
                  nowMinutes={nowMinutes}
                  loading={loading}
                  onOpen={(x) => setDialog({ id: x.id, reschedule: false })}
                  onStep={(x) => void advance(x)}
                  onMessage={setMessaging}
                  onNew={(start) => setCreating({ date: today, start, professionalId: visiblePros.length === 1 ? visiblePros[0].id : undefined })}
                />
                <TodayMessages clientsOnly />
              </>
            ) : (
              <>
              <div className="agenda">
                <div className="agenda__head" style={{ gridTemplateColumns: `52px repeat(${visiblePros.length}, minmax(0, 1fr))` }}>
                  <span />
                  {visiblePros.map((p) => (
                    <div key={p.id} className="agenda__pro">
                      <Avatar name={p.name} size="sm" />
                      <div className="agenda__pro-text">
                        <p className="agenda__pro-name">{p.name}</p>
                        <p className="agenda__pro-role">{p.role}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="agenda__scroll" ref={scrollRef}>
                  <div
                    className="agenda__body"
                    style={{ height: gridHeight, gridTemplateColumns: `52px repeat(${visiblePros.length}, minmax(0, 1fr))` }}
                  >
                    <div className="agenda__hours" aria-hidden="true">
                      {hours.map((h) => (
                        <span key={h} className="agenda__hour" style={{ top: (h - startHour) * HOUR_H }}>
                          {String(h).padStart(2, '0')}:00
                        </span>
                      ))}
                    </div>

                    {visiblePros.map((p) => (
                      <div key={p.id} className="agenda__col agenda__col--click" onClick={(e) => openSlot(e, p.id)} onContextMenu={(e) => slotMenu(e, p.id)}>
                        {hours.map((h) => (
                          <div key={h} className="agenda__line" style={{ top: (h - startHour) * HOUR_H }} />
                        ))}
                        {closedRanges(workingHours[p.id], date.getDay(), startHour, endHour).map(([from, to]) => (
                          <div
                            key={from}
                            className="agenda__closed"
                            style={{ top: toY(from), height: ((to - from) / 60) * HOUR_H }}
                            title="Fora do horário de atendimento"
                          />
                        ))}
                        {dayAppointments
                          .filter((a) => a.professionalId === p.id)
                          .map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              className={`appt appt--${a.status}`}
                              style={{ top: toY(a.start) + 2, height: (a.duration / 60) * HOUR_H - 4 }}
                              onClick={() => setDialog({ id: a.id, reschedule: false })}
                              onContextMenu={(e) => appointmentMenu(e, a)}
                            >
                              <span className="appt__time">
                                {formatTime(a.start)} – {formatTime(a.start + a.duration)}
                              </span>
                              <span className="appt__client">{a.client}</span>
                              <span className="appt__service">{a.service}</span>
                            </button>
                          ))}
                      </div>
                    ))}

                    {showNow && (
                      <div className="agenda__now" style={{ top: toY(nowMinutes) }} aria-hidden="true">
                        <span className="agenda__now-dot" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <ul className="legend" aria-label="Legenda de status">
                <li><span className="legend__dot legend__dot--confirmado" />Confirmado</li>
                <li><span className="legend__dot legend__dot--pendente" />Aguardando</li>
                <li><span className="legend__dot legend__dot--atendimento" />Em atendimento</li>
                <li><span className="legend__dot legend__dot--concluido" />Concluído</li>
                <li><span className="legend__dot legend__dot--faltou" />Faltou</li>
              </ul>
              </>
            )}
          </>
        )}
      </div>

      {selected && dialog && (
        <AppointmentDialog
          key={`${selected.id}-${dialog.reschedule}`}
          appointment={selected}
          startRescheduling={dialog.reschedule}
          onClose={() => setDialog(null)}
          notify={notify}
          onDuplicate={duplicate}
          onMessage={setMessaging}
        />
      )}
      {messaging && <AppointmentMessageDialog appointment={messaging} onClose={() => setMessaging(null)} />}
      {editingHours && <WorkingHoursDialog onClose={() => setEditingHours(false)} notify={notify} />}
      {creating && <NewAppointmentDialog initial={creating} onClose={() => setCreating(null)} notify={notify} />}
      {confirm && (
        <ConfirmDialog
          title="Cancelar atendimento?"
          text={`O horário de ${confirm.client} (${formatTime(confirm.start)}) volta a ficar livre.`}
          confirmLabel="Cancelar atendimento"
          onClose={() => setConfirm(null)}
          onConfirm={() => void patch(confirm, { status: 'cancelado' }, `Cancelado: ${confirm.client}`)}
        />
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={closeMenu} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

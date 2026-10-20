import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, isSameDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarPlus, Clock, LayoutGrid, List, RotateCcw } from 'lucide-react'
import { useAgenda } from '../../data/AgendaProvider'
import { STATUS_NAME, appointmentsOn, countByDay, earliestStart, findConflict, nextStep, showsNow, summarizeDay } from '../../domain/agenda'
import { useSubscription } from '../../billing/SubscriptionProvider'
import { dayKey, gridWindow } from '../../lib/agendaTime'
import { formatTime } from '../../lib/format'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { PageHeader, Tabs } from '../../components/ui'
import { AppointmentDialog, NewAppointmentDialog, whatsappLink, type NewInitial } from '../../components/AppointmentDialogs'
import { appointmentEntries } from '../../components/appointmentMenu'
import { ContextMenu, type MenuEntry } from '../../components/ContextMenu'
import { ConfirmDialog } from '../../components/Modal'
import { AppointmentMessageDialog } from '../../components/MessageDialog'
import { WorkingHoursDialog } from '../../components/WorkingHoursDialog'
import { PendingBanner } from '../../components/PendingRequests'
import { DayAgenda } from '../../components/DayAgenda'
import { TodayMessages } from '../../components/TodayMessages'
import type { Appointment } from '../../types'
import { CalendarCard, type CalendarView } from './CalendarCard'
import { DayList } from './DayList'
import { DaySummary } from './DaySummary'
import { FirstProfessional, NoAgenda, SoloProfessional } from './ProfessionalSetup'
import { useAuth } from '../../auth/AuthProvider'
import { roleAccess } from '../../domain/team'
import { TimeGrid } from './TimeGrid'
import './Agenda.css'

type Mode = 'lista' | 'grade'
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const MODE_KEY = 'ikizy:agenda-modo'

/** celular e tablet: lista do dia (padrão) ou grade; a escolha fica guardada neste aparelho */
function useSavedMode(): [Mode, (m: Mode) => void] {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'grade' ? 'grade' : 'lista'
    } catch {
      return 'lista'
    }
  })
  const choose = (m: Mode) => {
    setMode(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      // sem armazenamento: vale só nesta visita
    }
  }
  return [mode, choose]
}

export default function Agenda() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isDesktop = useMediaQuery('(min-width: 1100px)')
  const { professionals, appointments, pending, workingHours, loading, error, focus, reload, update } = useAgenda()
  const [params, setParams] = useSearchParams()
  const { sub, loading: subLoading } = useSubscription()
  const { salon } = useAuth()
  // só quem cuida do negócio cadastra quem atende; a recepção e a profissional só esperam
  const canSetUp = roleAccess(salon?.role ?? 'owner').business
  const [editingHours, setEditingHours] = useState(false)
  const [date, setDate] = useState(() => new Date())
  const [proFilter, setProFilter] = useState<string>('all')
  const [dialog, setDialog] = useState<{ id: string; reschedule: boolean } | null>(null)
  const [creating, setCreating] = useState<NewInitial | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)
  const [confirm, setConfirm] = useState<Appointment | null>(null)
  const [messaging, setMessaging] = useState<Appointment | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useState<CalendarView>('semana')
  const [mode, chooseMode] = useSavedMode()
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
  const isToday = isSameDay(date, now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const dayAppointments = useMemo(() => appointmentsOn(appointments, today), [appointments, today])
  // a lista do celular segue o filtro de profissional (e o número no cabeçalho dela também)
  const listItems = useMemo(
    () => (activePro === 'all' ? dayAppointments : dayAppointments.filter((x) => x.professionalId === activePro)),
    [dayAppointments, activePro],
  )
  const countsByDay = useMemo(() => countByDay(appointments), [appointments])
  const summary = useMemo(() => summarizeDay(appointments, today, isToday ? nowMinutes : null), [appointments, today, isToday, nowMinutes])
  const professionalName = (id: string) => professionals.find((p) => p.id === id)?.name ?? ''

  // a grade vai do horário de atendimento cadastrado (não mais 8h–20h fixo)
  const { startHour, endHour } = useMemo(
    () => gridWindow(visiblePros.map((p) => workingHours[p.id] ?? []), dayAppointments),
    [visiblePros, workingHours, dayAppointments],
  )
  const nowVisible = showsNow(isToday, nowMinutes, startHour, endHour)
  // no desktop a grade rola por dentro: abre perto do horário atual (ou do primeiro atendimento)
  const scrollAnchor = isToday ? nowMinutes : earliestStart(dayAppointments)

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
    // já na agenda, o [+] agenda no dia que está aberto (vindo de outra tela, é hoje)
    setCreating({ date: today, start: null, clientName: params.get('cliente') ?? undefined })
    setParams({}, { replace: true })
  }, [params, setParams, loading]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const slotMenu = (e: MouseEvent, professionalId: string, minutes: number) =>
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

  const patch = async (a: Appointment, changes: Parameters<typeof update>[1], ok: string) => {
    const message = await update(a.id, changes)
    notify(message ?? ok)
  }

  /** botão do momento na lista: confirmar e iniciar são diretos; concluir abre o atendimento (pede a forma de pagamento) */
  const advance = async (a: Appointment) => {
    const step = nextStep(a.status)
    if (step === 'confirm') {
      const message = await update(a.id, { status: 'confirmado' })
      if (message) return notify(message)
      notify(`${a.client}: confirmado`)
      // a cliente precisa saber: já abre a mensagem pronta de confirmação
      if (a.phone.replace(/\D/g, '')) setMessaging({ ...a, status: 'confirmado' })
    } else if (step === 'start') void patch(a, { status: 'atendimento' }, `${a.client}: em atendimento`)
    else setDialog({ id: a.id, reschedule: false })
  }

  const duplicate = (a: Appointment) =>
    setCreating({ date: a.date, start: null, professionalId: a.professionalId, clientName: a.client, serviceId: a.serviceId ?? undefined })

  const appointmentMenu = (e: MouseEvent, a: Appointment) => {
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
            const name = professionalName(id)
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

  const calendarSummary = loading
    ? 'Carregando…'
    : summary.count === 0
      ? 'Nenhum atendimento neste dia'
      : `${summary.count} ${summary.count === 1 ? 'atendimento' : 'atendimentos'} em ${format(date, "d 'de' MMMM", { locale: ptBR })}`

  return (
    <div className="page agendapage">
      <PageHeader title="Agenda" className="pageheader--mobile" />
      <div className="agendapage__side">
        <CalendarCard
          side={isDesktop}
          date={date}
          now={now}
          view={view}
          counts={countsByDay}
          summary={calendarSummary}
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
          subLoading ? null : !canSetUp ? <NoAgenda /> : sub && sub.plan !== 'solo' ? <FirstProfessional /> : <SoloProfessional />
        ) : (
          <>
            {isDesktop && !loading && <DaySummary summary={summary} isToday={isToday} professionalName={professionalName} />}

            <PendingBanner
              onOpen={(id) => {
                const a = pending?.find((x) => x.id === id)
                if (a) openRequest(a)
              }}
              notify={notify}
              collapsed={!isDesktop}
            />

            <div className={`chips ${isDesktop ? '' : 'chips--scroll'}`.trim()} role="group" aria-label="Filtrar por profissional">
              {!isDesktop && (
                <Tabs
                  label="Visualização do dia"
                  value={listMode ? 'lista' : 'grade'}
                  onChange={chooseMode}
                  items={[
                    { id: 'lista', label: <List size={16} aria-hidden="true" />, ariaLabel: 'Lista' },
                    { id: 'grade', label: <LayoutGrid size={16} aria-hidden="true" />, ariaLabel: 'Grade' },
                  ]}
                />
              )}
              {(!isMobile || listMode) && professionals.length > 1 && (
                <button type="button" className="chip" aria-pressed={activePro === 'all'} onClick={() => setProFilter('all')}>
                  Todas
                </button>
              )}
              {professionals.length > 1 &&
                professionals.map((p) => (
                  <button key={p.id} type="button" className="chip" aria-pressed={activePro === p.id} onClick={() => setProFilter(p.id)}>
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
                  title={{
                    day: isToday ? `Hoje, ${format(date, "d 'de' MMM", { locale: ptBR }).replace('.', '')}` : capitalize(format(date, "EEEE, d 'de' MMM", { locale: ptBR }).replace('.', '')),
                    count: loading ? '' : listItems.length === 0 ? 'sem atendimentos' : `${listItems.length} ${listItems.length === 1 ? 'atendimento' : 'atendimentos'}`,
                  }}
                  items={listItems}
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
              <TimeGrid
                professionals={visiblePros}
                workingHours={workingHours}
                appointments={dayAppointments}
                date={date}
                startHour={startHour}
                endHour={endHour}
                nowMinutes={nowVisible ? nowMinutes : null}
                scrollAnchor={scrollAnchor}
                scrollKey={`${today}-${isDesktop}`}
                onSlot={(professionalId, minutes) => setCreating({ date: today, start: minutes, professionalId })}
                onSlotMenu={(e, professionalId, minutes) => slotMenu(e, professionalId, minutes)}
                onOpen={(id) => setDialog({ id, reschedule: false })}
                onMenu={appointmentMenu}
              />
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

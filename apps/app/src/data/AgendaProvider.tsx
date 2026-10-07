import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { addMonths, format, startOfMonth } from 'date-fns'
import { useAuth } from '../auth/AuthProvider'
import { isNeonConfigured, neon } from '../lib/neon'
import { ACTIVE_STATUSES, type Appointment, type AppointmentStatus, type Professional } from '../types'
import { appointments as mockAppointments, professionals as mockProfessionals } from './mock'
import { getClients } from './clients'

export interface ClientOption {
  id: string
  name: string
  phone: string
}

export interface ServiceOption {
  id: string
  name: string
  price: number
  duration: number
}

export interface NewAppointment {
  /** vazio = cliente nova, criada junto com o agendamento */
  clientId?: string
  clientName: string
  phone: string
  professionalId: string
  serviceId: string | null
  serviceName: string
  date: string
  start: number
  duration: number
  price: number
}

export type AppointmentPatch = Partial<Pick<Appointment, 'status' | 'date' | 'start' | 'professionalId' | 'duration' | 'price'>>

interface AgendaState {
  loading: boolean
  error: string | null
  professionals: Professional[]
  clients: ClientOption[]
  services: ServiceOption[]
  appointments: Appointment[]
  /** garante que o período em volta da data esteja carregado */
  focus: (date: Date) => void
  reload: () => void
  create: (input: NewAppointment) => Promise<string | null>
  update: (id: string, patch: AppointmentPatch) => Promise<string | null>
  addProfessional: (name: string, title: string) => Promise<string | null>
}

const AgendaContext = createContext<AgendaState | null>(null)

export function useAgenda() {
  const ctx = useContext(AgendaContext)
  if (!ctx) throw new Error('useAgenda precisa estar dentro de <AgendaProvider>')
  return ctx
}

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

/** outro atendimento ativo da mesma profissional que se sobrepõe ao intervalo informado */
export function findConflict(
  list: Appointment[],
  slot: { professionalId: string; date: string; start: number; duration: number },
  ignoreId?: string,
) {
  return list.find(
    (a) =>
      a.id !== ignoreId &&
      a.professionalId === slot.professionalId &&
      a.date === slot.date &&
      ACTIVE_STATUSES.includes(a.status) &&
      a.start < slot.start + slot.duration &&
      slot.start < a.start + a.duration,
  )
}

const toIso = (date: string, start: number) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, Math.floor(start / 60), start % 60).toISOString()
}

interface Row {
  id: string
  client_id: string
  professional_id: string
  service_id: string | null
  service_name: string
  starts_at: string
  duration: number
  price: number | string
  status: AppointmentStatus
  clients: { name: string; phone: string } | null
}

const SELECT =
  'id, client_id, professional_id, service_id, service_name, starts_at, duration, price, status, clients ( name, phone )'

function fromRow(r: Row): Appointment {
  const at = new Date(r.starts_at)
  return {
    id: r.id,
    professionalId: r.professional_id,
    clientId: r.client_id,
    client: r.clients?.name ?? 'Cliente',
    phone: r.clients?.phone ?? '',
    serviceId: r.service_id,
    service: r.service_name,
    date: dayKey(at),
    start: at.getHours() * 60 + at.getMinutes(),
    duration: r.duration,
    price: Number(r.price),
    status: r.status,
  }
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === '23514' || error.message.includes('já está fechado')) return 'O mês desse atendimento já está fechado.'
  return 'Não foi possível salvar agora. Tente novamente.'
}

/** dados de exemplo (modo demonstração): os mesmos do mock, ancorados em hoje */
function demoData() {
  const today = dayKey(new Date())
  const clients = getClients().map((c) => ({ id: c.id, name: c.name, phone: c.phone }))
  const byName = new Map(clients.map((c) => [c.name, c]))
  const appts: Appointment[] = mockAppointments.map((a) => ({
    id: a.id,
    professionalId: a.professionalId,
    clientId: byName.get(a.client)?.id ?? a.client,
    client: a.client,
    phone: byName.get(a.client)?.phone ?? '',
    serviceId: null,
    service: a.service,
    date: today,
    start: a.start,
    duration: a.duration,
    price: a.price,
    status: a.status,
  }))
  const seen = new Map<string, ServiceOption>()
  for (const a of mockAppointments) {
    if (!seen.has(a.service)) seen.set(a.service, { id: a.service, name: a.service, price: a.price, duration: a.duration })
  }
  return { clients, appts, services: [...seen.values()] }
}

export function AgendaProvider({ children }: { children: ReactNode }) {
  const { salon } = useAuth()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)

  const [professionals, setProfessionals] = useState<Professional[]>(live ? [] : mockProfessionals)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [win, setWin] = useState(() => ({
    from: startOfMonth(addMonths(new Date(), -1)),
    to: startOfMonth(addMonths(new Date(), 2)),
  }))

  // modo demonstração: tudo em memória
  useEffect(() => {
    if (live) return
    const d = demoData()
    setProfessionals(mockProfessionals)
    setClients(d.clients)
    setServices(d.services)
    setAppointments(d.appts)
    setLoading(false)
  }, [live])

  // cadastros do salão
  useEffect(() => {
    if (!live || !neon || !salonId) return
    let cancelled = false
    void (async () => {
      const [pros, cls, svcs] = await Promise.all([
        neon.from('professionals').select('id, name, title').eq('salon_id', salonId).eq('active', true).order('name'),
        neon.from('clients').select('id, name, phone').eq('salon_id', salonId).order('name'),
        neon.from('services').select('id, name, price, duration').eq('salon_id', salonId).order('name'),
      ])
      if (cancelled) return
      if (pros.error || cls.error || svcs.error) {
        setError('Não foi possível carregar a agenda. Verifique a conexão e tente de novo.')
        setLoading(false)
        return
      }
      setProfessionals((pros.data ?? []).map((p) => ({ id: p.id, name: p.name, role: p.title })))
      setClients((cls.data ?? []).map((c) => ({ id: c.id, name: c.name, phone: c.phone })))
      setServices((svcs.data ?? []).map((s) => ({ id: s.id, name: s.name, price: Number(s.price), duration: s.duration })))
    })()
    return () => {
      cancelled = true
    }
  }, [live, salonId, tick])

  // atendimentos do período
  useEffect(() => {
    if (!live || !neon || !salonId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      const { data, error: err } = await neon
        .from('appointments')
        .select(SELECT)
        .eq('salon_id', salonId)
        .gte('starts_at', win.from.toISOString())
        .lt('starts_at', win.to.toISOString())
        .order('starts_at')
      if (cancelled) return
      if (err) setError('Não foi possível carregar os atendimentos. Tente de novo.')
      else {
        setError(null)
        setAppointments((data as unknown as Row[]).map(fromRow))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [live, salonId, win, tick])

  const focus = useCallback((date: Date) => {
    setWin((w) =>
      date >= w.from && date < w.to
        ? w
        : { from: startOfMonth(addMonths(date, -1)), to: startOfMonth(addMonths(date, 2)) },
    )
  }, [])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  const create = useCallback(
    async (input: NewAppointment) => {
      let clientId = input.clientId
      if (!live || !neon || !salonId) {
        if (!clientId) {
          clientId = `novo-${Date.now()}`
          setClients((c) => [...c, { id: clientId!, name: input.clientName, phone: input.phone }])
        }
        setAppointments((list) => [
          ...list,
          {
            id: `a-${Date.now()}`,
            professionalId: input.professionalId,
            clientId: clientId!,
            client: input.clientName,
            phone: input.phone,
            serviceId: input.serviceId,
            service: input.serviceName,
            date: input.date,
            start: input.start,
            duration: input.duration,
            price: input.price,
            status: 'confirmado',
          },
        ])
        return null
      }
      if (!clientId) {
        const { data, error: err } = await neon
          .from('clients')
          .insert({ salon_id: salonId, name: input.clientName, phone: input.phone })
          .select('id')
          .single()
        if (err || !data) return friendly(err ?? { message: '' })
        clientId = data.id as string
        setClients((c) => [...c, { id: clientId!, name: input.clientName, phone: input.phone }])
      }
      const { data, error: err } = await neon
        .from('appointments')
        .insert({
          salon_id: salonId,
          client_id: clientId,
          professional_id: input.professionalId,
          service_id: input.serviceId,
          service_name: input.serviceName,
          starts_at: toIso(input.date, input.start),
          duration: input.duration,
          price: input.price,
          status: 'confirmado',
        })
        .select(SELECT)
        .single()
      if (err || !data) return friendly(err ?? { message: '' })
      setAppointments((list) => [...list, fromRow(data as unknown as Row)])
      return null
    },
    [live, salonId],
  )

  const update = useCallback(
    async (id: string, patch: AppointmentPatch) => {
      if (live && neon) {
        const cols: Record<string, unknown> = {}
        const current = appointments.find((a) => a.id === id)
        if (patch.status) cols.status = patch.status
        if (patch.professionalId) cols.professional_id = patch.professionalId
        if (patch.duration !== undefined) cols.duration = patch.duration
        if (patch.price !== undefined) cols.price = patch.price
        if (current && (patch.date || patch.start !== undefined)) {
          cols.starts_at = toIso(patch.date ?? current.date, patch.start ?? current.start)
        }
        const { data, error: err } = await neon.from('appointments').update(cols).eq('id', id).select('id')
        if (err) return friendly(err)
        if (!data?.length) return 'Você não tem permissão para alterar este atendimento.'
      }
      setAppointments((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)))
      return null
    },
    [live, appointments],
  )

  const addProfessional = useCallback(
    async (name: string, title: string) => {
      const clean = name.trim()
      if (clean.length < 2) return 'Informe o nome da profissional.'
      if (live && neon && salonId) {
        const { data, error: err } = await neon
          .from('professionals')
          .insert({ salon_id: salonId, name: clean, title: title.trim() })
          .select('id, name, title')
          .single()
        if (err || !data) return friendly(err ?? { message: '' })
        setProfessionals((p) => [...p, { id: data.id as string, name: data.name as string, role: data.title as string }])
        return null
      }
      setProfessionals((p) => [...p, { id: `p-${Date.now()}`, name: clean, role: title.trim() }])
      return null
    },
    [live, salonId],
  )

  const value = useMemo<AgendaState>(
    () => ({ loading, error, professionals, clients, services, appointments, focus, reload, create, update, addProfessional }),
    [loading, error, professionals, clients, services, appointments, focus, reload, create, update, addProfessional],
  )

  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>
}

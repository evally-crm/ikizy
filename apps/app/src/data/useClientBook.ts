import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../auth/AuthProvider'
import { isNeonConfigured, neon } from '../lib/neon'
import { parseAnamnesis, type Anamnesis } from '../lib/anamnesis'
import type { AppointmentStatus } from '../types'
import { DEFAULT_INTERVAL, averageInterval, isForgotten } from '../domain/clients'
import { getClients, type Client, type ClientAppointment } from './clients'
import { professionals as mockProfessionals } from './mock'

export interface ClientDraft {
  name: string
  phone: string
  /** yyyy-MM-dd ou vazio */
  birthday: string
  vip: boolean
  professionalId: string | null
  allergies: string[]
  preferences: string[]
  email: string
  instagram: string
  address: string
  occupation: string
  referral: string
}

export interface ProfessionalOption {
  id: string
  name: string
}

export interface ClientNote {
  id: string
  body: string
  date: Date
}


const CLIENT_COLUMNS =
  'id, name, phone, birthday, vip, preferred_professional, allergies, preferences, anamnesis_signed_at, created_at, email, instagram, address, occupation, referral, anamnesis, anamnesis_updated_at, anamnesis_signature'

interface ClientRow {
  id: string
  name: string
  phone: string
  birthday: string | null
  vip: boolean
  preferred_professional: string | null
  allergies: string[] | null
  preferences: string[] | null
  anamnesis_signed_at: string | null
  created_at: string
  email: string | null
  instagram: string | null
  address: string | null
  occupation: string | null
  referral: string | null
  anamnesis: unknown
  anamnesis_updated_at: string | null
  anamnesis_signature: string | null
}

interface AppointmentRow {
  client_id: string
  professional_id: string
  service_name: string
  starts_at: string
  price: number | string
  status: AppointmentStatus
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) return 'Seu acesso não permite alterar isso agora.'
  if (error.code === '23505' && error.message.includes('clients_salon_phone_unique')) return 'Já existe uma cliente com esse WhatsApp.'
  return 'Não foi possível salvar agora. Tente novamente.'
}

const draftColumns = (draft: ClientDraft) => ({
  name: draft.name,
  phone: draft.phone,
  birthday: draft.birthday || null,
  vip: draft.vip,
  preferred_professional: draft.professionalId,
  allergies: draft.allergies,
  preferences: draft.preferences,
  email: draft.email,
  instagram: draft.instagram,
  address: draft.address,
  occupation: draft.occupation,
  referral: draft.referral,
})

/** monta a ficha a partir da linha da cliente e dos atendimentos */
function buildClient(row: ClientRow, rows: AppointmentRow[], fallbackProfessional: string): Client {
  const appointments: ClientAppointment[] = rows
    .map((v) => ({
      date: new Date(v.starts_at),
      service: v.service_name,
      professionalId: v.professional_id,
      price: Number(v.price),
      status: v.status,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
  const done = appointments.filter((a) => a.status === 'concluido')
  const since = new Date(row.created_at)
  const lastVisit = done[0]?.date ?? since
  // intervalo médio entre as visitas; com menos de duas, usamos um padrão
  const interval = averageInterval(done.map((a) => a.date))
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    since,
    birthday: row.birthday ? format(parseISO(row.birthday), 'MM-dd') : '',
    vip: row.vip,
    professionalId: row.preferred_professional ?? done[0]?.professionalId ?? fallbackProfessional,
    visits: done.length,
    totalSpent: done.reduce((sum, v) => sum + v.price, 0),
    lastVisit,
    interval,
    allergies: row.allergies ?? [],
    preferences: row.preferences ?? [],
    anamnesisSignedAt: row.anamnesis_signed_at ? new Date(row.anamnesis_signed_at) : null,
    email: row.email ?? '',
    instagram: row.instagram ?? '',
    address: row.address ?? '',
    occupation: row.occupation ?? '',
    referral: row.referral ?? '',
    anamnesis: parseAnamnesis(row.anamnesis),
    anamnesisUpdatedAt: row.anamnesis_updated_at ? new Date(row.anamnesis_updated_at) : null,
    anamnesisSignature: row.anamnesis_signature,
    history: done.map(({ status: _status, ...v }) => v),
    appointments,
  }
}

/** contatos (clientes): dados reais do Neon, ou exemplos quando não há banco configurado */
export function useClientBook() {
  const { salon } = useAuth()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)
  const canManage = !live || salon?.role === 'owner' || salon?.role === 'manager'
  /** só a dona apaga dados de cliente (LGPD) */
  const canForget = !live || salon?.role === 'owner'

  const [clients, setClients] = useState<Client[]>(() => (live ? [] : getClients()))
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>(() => (live ? [] : mockProfessionals))
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!live || !neon || !salonId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      const [pros, cls, appts] = await Promise.all([
        neon.from('professionals').select('id, name').eq('salon_id', salonId).eq('active', true).order('name'),
        neon.from('clients').select(CLIENT_COLUMNS).eq('salon_id', salonId).order('name'),
        neon
          .from('appointments')
          .select('client_id, professional_id, service_name, starts_at, price, status')
          .eq('salon_id', salonId),
      ])
      if (cancelled) return
      if (pros.error || cls.error || appts.error) {
        setError('Não foi possível carregar as clientes. Verifique a conexão e tente de novo.')
        setLoading(false)
        return
      }
      const byClient = new Map<string, AppointmentRow[]>()
      for (const v of (appts.data ?? []) as unknown as AppointmentRow[]) {
        const list = byClient.get(v.client_id) ?? []
        list.push(v)
        byClient.set(v.client_id, list)
      }
      const proList = (pros.data ?? []).map((p) => ({ id: p.id as string, name: p.name as string }))
      setProfessionals(proList)
      setClients(
        ((cls.data ?? []) as unknown as ClientRow[]).filter((c) => !isForgotten(c.name)).map((c) =>
          buildClient(c, byClient.get(c.id) ?? [], proList[0]?.id ?? ''),
        ),
      )
      setError(null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [live, salonId, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  /** troca a cliente na lista local (modo demonstração e resposta imediata na tela) */
  const patchLocal = useCallback((id: string, patch: (c: Client) => Client) => {
    setClients((list) => list.map((c) => (c.id === id ? patch(c) : c)))
  }, [])

  /** devolve o id da cliente criada (ou a mensagem de erro) */
  const create = useCallback(
    async (draft: ClientDraft): Promise<{ id: string | null; error: string | null }> => {
      if (!live || !neon || !salonId) {
        const id = `novo-${Date.now()}`
        const now = new Date()
        setClients((list) => [
          ...list,
          {
            ...draft,
            id,
            since: now,
            birthday: draft.birthday ? draft.birthday.slice(5) : '',
            professionalId: draft.professionalId ?? professionals[0]?.id ?? '',
            visits: 0,
            totalSpent: 0,
            lastVisit: now,
            interval: DEFAULT_INTERVAL,
            anamnesisSignedAt: null,
            anamnesis: { answers: {}, notes: '' },
            anamnesisUpdatedAt: null,
            anamnesisSignature: null,
            history: [],
            appointments: [],
          },
        ])
        return { id, error: null }
      }
      const { data, error: err } = await neon
        .from('clients')
        .insert({ salon_id: salonId, ...draftColumns(draft) })
        .select('id')
        .single()
      if (err || !data) return { id: null, error: friendly(err ?? { message: '' }) }
      reload()
      return { id: data.id as string, error: null }
    },
    [live, salonId, professionals, reload],
  )

  /** grava colunas da cliente e atualiza a tela; devolve a mensagem de erro, se houver */
  const save = useCallback(
    async (id: string, columns: Record<string, unknown>, patch: (c: Client) => Client): Promise<string | null> => {
      if (!live || !neon || !salonId) {
        patchLocal(id, patch)
        return null
      }
      const { data, error: err } = await neon.from('clients').update(columns).eq('id', id).select('id')
      if (err || !data?.length) return friendly(err ?? { message: '' })
      patchLocal(id, patch)
      return null
    },
    [live, salonId, patchLocal],
  )

  const update = useCallback(
    (id: string, draft: ClientDraft) =>
      save(id, draftColumns(draft), (c) => ({
        ...c,
        ...draft,
        birthday: draft.birthday ? draft.birthday.slice(5) : '',
        professionalId: draft.professionalId ?? c.professionalId,
      })),
    [save],
  )

  /** preferências e alergias editadas direto no card de cuidados */
  const updateCare = useCallback(
    (id: string, care: { preferences: string[]; allergies: string[] }) =>
      save(id, care, (c) => ({ ...c, ...care })),
    [save],
  )

  const saveAnamnesis = useCallback(
    (id: string, anamnesis: Anamnesis) => {
      const at = new Date()
      return save(id, { anamnesis, anamnesis_updated_at: at.toISOString() }, (c) => ({ ...c, anamnesis, anamnesisUpdatedAt: at }))
    },
    [save],
  )

  /** registra a assinatura do termo (desenhada na tela) ou a remove para assinar de novo */
  const signAnamnesis = useCallback(
    (id: string, signature: string | null) => {
      const at = signature ? new Date() : null
      return save(
        id,
        { anamnesis_signed_at: at ? at.toISOString() : null, anamnesis_signature: signature },
        (c) => ({ ...c, anamnesisSignedAt: at, anamnesisSignature: signature }),
      )
    },
    [save],
  )

  /** apaga os dados pessoais da cliente (LGPD); com histórico, a ficha fica anônima para não quebrar o financeiro */
  const forget = useCallback(
    async (id: string): Promise<string | null> => {
      if (live && neon) {
        const { error: err } = await neon.rpc('forget_client', { p_client: id })
        if (err) return friendly(err)
      }
      setClients((list) => list.filter((c) => c.id !== id))
      return null
    },
    [live],
  )

  return {
    live,
    canManage,
    canForget,
    clients,
    professionals,
    loading,
    error,
    create,
    update,
    updateCare,
    saveAnamnesis,
    signAnamnesis,
    forget,
    reload,
  }
}

/** anotações de uma cliente (carregadas só quando a ficha dela está aberta) */
export function useClientNotes(clientId: string | undefined) {
  const { salon } = useAuth()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNotes([])
    setError(null)
    if (!clientId || !live || !neon || !salonId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      const { data, error: err } = await neon
        .from('client_notes')
        .select('id, body, created_at')
        .eq('salon_id', salonId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (cancelled) return
      setLoading(false)
      if (err) {
        setError('Não foi possível carregar as anotações.')
        return
      }
      setNotes(((data ?? []) as { id: string; body: string; created_at: string }[]).map((n) => ({ id: n.id, body: n.body, date: new Date(n.created_at) })))
    })()
    return () => {
      cancelled = true
    }
  }, [clientId, live, salonId])

  const add = useCallback(
    async (body: string): Promise<string | null> => {
      if (!clientId) return null
      if (!live || !neon || !salonId) {
        setNotes((list) => [{ id: `n-${Date.now()}`, body, date: new Date() }, ...list])
        return null
      }
      const { data, error: err } = await neon
        .from('client_notes')
        .insert({ salon_id: salonId, client_id: clientId, body })
        .select('id, created_at')
        .single()
      if (err || !data) return friendly(err ?? { message: '' })
      setNotes((list) => [{ id: data.id as string, body, date: new Date(data.created_at as string) }, ...list])
      return null
    },
    [clientId, live, salonId],
  )

  const remove = useCallback(
    async (id: string): Promise<string | null> => {
      if (live && neon && salonId) {
        const { error: err } = await neon.from('client_notes').delete().eq('id', id)
        if (err) return friendly(err)
      }
      setNotes((list) => list.filter((n) => n.id !== id))
      return null
    },
    [live, salonId],
  )

  return { notes, loading, error, add, remove }
}

export type PhotoKind = 'antes' | 'depois' | 'outra'

export interface ClientPhoto {
  id: string
  kind: PhotoKind
  caption: string
  /** yyyy-MM-dd */
  takenOn: string
  thumb: string
}

export interface NewPhoto {
  kind: PhotoKind
  caption: string
  takenOn: string
  thumb: string
  data: string
}

/** fotos de antes e depois de uma cliente: a lista traz só as miniaturas; a foto inteira vem ao abrir */
export function useClientPhotos(clientId: string | undefined) {
  const { salon } = useAuth()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)
  const [photos, setPhotos] = useState<ClientPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // modo demonstração: a foto inteira fica só na memória
  const [localFull, setLocalFull] = useState<Record<string, string>>({})

  useEffect(() => {
    setPhotos([])
    setError(null)
    if (!clientId || !live || !neon || !salonId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      const { data, error: err } = await neon
        .from('client_photos')
        .select('id, kind, caption, taken_on, thumb')
        .eq('salon_id', salonId)
        .eq('client_id', clientId)
        .order('taken_on', { ascending: false })
        .order('created_at', { ascending: true })
      if (cancelled) return
      setLoading(false)
      if (err) {
        setError('Não foi possível carregar as fotos.')
        return
      }
      setPhotos(
        ((data ?? []) as { id: string; kind: PhotoKind; caption: string; taken_on: string; thumb: string }[]).map((p) => ({
          id: p.id,
          kind: p.kind,
          caption: p.caption,
          takenOn: p.taken_on,
          thumb: p.thumb,
        })),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [clientId, live, salonId])

  const sortPhotos = (list: ClientPhoto[]) => [...list].sort((a, b) => b.takenOn.localeCompare(a.takenOn))

  const add = useCallback(
    async (items: NewPhoto[]): Promise<string | null> => {
      if (!clientId || items.length === 0) return null
      if (!live || !neon || !salonId) {
        const made = items.map((p, i) => ({ id: `f-${Date.now()}-${i}`, kind: p.kind, caption: p.caption, takenOn: p.takenOn, thumb: p.thumb }))
        setLocalFull((m) => ({ ...m, ...Object.fromEntries(made.map((p, i) => [p.id, items[i].data])) }))
        setPhotos((list) => sortPhotos([...list, ...made]))
        return null
      }
      const { data, error: err } = await neon
        .from('client_photos')
        .insert(
          items.map((p) => ({
            salon_id: salonId,
            client_id: clientId,
            kind: p.kind,
            caption: p.caption,
            taken_on: p.takenOn,
            thumb: p.thumb,
            data: p.data,
          })),
        )
        .select('id')
      if (err || !data) return friendly(err ?? { message: '' })
      const ids = (data as { id: string }[]).map((r) => r.id)
      setPhotos((list) =>
        sortPhotos([...list, ...items.map((p, i) => ({ id: ids[i], kind: p.kind, caption: p.caption, takenOn: p.takenOn, thumb: p.thumb }))]),
      )
      return null
    },
    [clientId, live, salonId],
  )

  const remove = useCallback(
    async (id: string): Promise<string | null> => {
      if (live && neon && salonId) {
        const { error: err } = await neon.from('client_photos').delete().eq('id', id)
        if (err) return friendly(err)
      }
      setPhotos((list) => list.filter((p) => p.id !== id))
      return null
    },
    [live, salonId],
  )

  /** foto em tamanho bom para ver na tela */
  const loadFull = useCallback(
    async (id: string): Promise<string | null> => {
      if (!live || !neon || !salonId) return localFull[id] ?? null
      const { data, error: err } = await neon.from('client_photos').select('data').eq('id', id).maybeSingle()
      if (err || !data) return null
      return (data as { data: string }).data
    },
    [live, salonId, localFull],
  )

  return { photos, loading, error, add, remove, loadFull }
}

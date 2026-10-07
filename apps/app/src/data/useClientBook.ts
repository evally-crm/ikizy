import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../auth/AuthProvider'
import { isNeonConfigured, neon } from '../lib/neon'
import { getClients, type Client, type Visit } from './clients'
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
}

export interface ProfessionalOption {
  id: string
  name: string
}

const DAY = 24 * 60 * 60 * 1000
const DEFAULT_INTERVAL = 30

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
}

interface VisitRow {
  client_id: string
  professional_id: string
  service_name: string
  starts_at: string
  price: number | string
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) return 'Seu acesso não permite alterar clientes agora.'
  return 'Não foi possível salvar agora. Tente novamente.'
}

/** monta a ficha a partir da linha da cliente e dos atendimentos concluídos dela */
function buildClient(row: ClientRow, visits: VisitRow[], fallbackProfessional: string): Client {
  const done = visits
    .map((v) => ({ date: new Date(v.starts_at), service: v.service_name, professionalId: v.professional_id, price: Number(v.price) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
  const since = new Date(row.created_at)
  const lastVisit = done[0]?.date ?? since
  // intervalo médio entre as visitas; com menos de duas, usamos um padrão
  let interval = DEFAULT_INTERVAL
  if (done.length > 1) {
    const span = done[0].date.getTime() - done[done.length - 1].date.getTime()
    interval = Math.max(1, Math.round(span / DAY / (done.length - 1)))
  }
  const history: Visit[] = done.slice(0, 6)
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
    history,
  }
}

/** carteira de clientes: dados reais do Neon, ou exemplos quando não há banco configurado */
export function useClientBook() {
  const { salon } = useAuth()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)

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
      const [pros, cls, visits] = await Promise.all([
        neon.from('professionals').select('id, name').eq('salon_id', salonId).eq('active', true).order('name'),
        neon
          .from('clients')
          .select('id, name, phone, birthday, vip, preferred_professional, allergies, preferences, anamnesis_signed_at, created_at')
          .eq('salon_id', salonId)
          .order('name'),
        neon
          .from('appointments')
          .select('client_id, professional_id, service_name, starts_at, price')
          .eq('salon_id', salonId)
          .eq('status', 'concluido'),
      ])
      if (cancelled) return
      if (pros.error || cls.error || visits.error) {
        setError('Não foi possível carregar as clientes. Verifique a conexão e tente de novo.')
        setLoading(false)
        return
      }
      const byClient = new Map<string, VisitRow[]>()
      for (const v of (visits.data ?? []) as unknown as VisitRow[]) {
        const list = byClient.get(v.client_id) ?? []
        list.push(v)
        byClient.set(v.client_id, list)
      }
      const proList = (pros.data ?? []).map((p) => ({ id: p.id as string, name: p.name as string }))
      setProfessionals(proList)
      setClients(((cls.data ?? []) as unknown as ClientRow[]).map((c) => buildClient(c, byClient.get(c.id) ?? [], proList[0]?.id ?? '')))
      setError(null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [live, salonId, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  /** devolve o id da cliente criada (ou a mensagem de erro) */
  const create = useCallback(
    async (draft: ClientDraft): Promise<{ id: string | null; error: string | null }> => {
      if (!live || !neon || !salonId) {
        const id = `novo-${Date.now()}`
        const now = new Date()
        setClients((list) => [
          ...list,
          {
            id,
            name: draft.name,
            phone: draft.phone,
            since: now,
            birthday: draft.birthday ? draft.birthday.slice(5) : '',
            vip: draft.vip,
            professionalId: draft.professionalId ?? professionals[0]?.id ?? '',
            visits: 0,
            totalSpent: 0,
            lastVisit: now,
            interval: DEFAULT_INTERVAL,
            allergies: draft.allergies,
            preferences: draft.preferences,
            anamnesisSignedAt: null,
            history: [],
          },
        ])
        return { id, error: null }
      }
      const { data, error: err } = await neon
        .from('clients')
        .insert({
          salon_id: salonId,
          name: draft.name,
          phone: draft.phone,
          birthday: draft.birthday || null,
          vip: draft.vip,
          preferred_professional: draft.professionalId,
          allergies: draft.allergies,
          preferences: draft.preferences,
        })
        .select('id')
        .single()
      if (err || !data) return { id: null, error: friendly(err ?? { message: '' }) }
      reload()
      return { id: data.id as string, error: null }
    },
    [live, salonId, professionals, reload],
  )

  const update = useCallback(
    async (id: string, draft: ClientDraft): Promise<string | null> => {
      if (!live || !neon || !salonId) {
        setClients((list) =>
          list.map((c) =>
            c.id === id
              ? {
                  ...c,
                  name: draft.name,
                  phone: draft.phone,
                  birthday: draft.birthday ? draft.birthday.slice(5) : '',
                  vip: draft.vip,
                  professionalId: draft.professionalId ?? c.professionalId,
                  allergies: draft.allergies,
                  preferences: draft.preferences,
                }
              : c,
          ),
        )
        return null
      }
      const { data, error: err } = await neon
        .from('clients')
        .update({
          name: draft.name,
          phone: draft.phone,
          birthday: draft.birthday || null,
          vip: draft.vip,
          preferred_professional: draft.professionalId,
          allergies: draft.allergies,
          preferences: draft.preferences,
        })
        .eq('id', id)
        .select('id')
      if (err || !data?.length) return friendly(err ?? { message: '' })
      reload()
      return null
    },
    [live, salonId, reload],
  )

  /** registra que a ficha de anamnese foi assinada (a assinatura em si é feita fora do sistema por enquanto) */
  const markAnamnesis = useCallback(
    async (id: string, signed: boolean): Promise<string | null> => {
      const at = signed ? new Date() : null
      if (!live || !neon || !salonId) {
        setClients((list) => list.map((c) => (c.id === id ? { ...c, anamnesisSignedAt: at } : c)))
        return null
      }
      const { data, error: err } = await neon
        .from('clients')
        .update({ anamnesis_signed_at: at ? at.toISOString() : null })
        .eq('id', id)
        .select('id')
      if (err || !data?.length) return friendly(err ?? { message: '' })
      reload()
      return null
    },
    [live, salonId, reload],
  )

  return { live, clients, professionals, loading, error, create, update, markAnamnesis, reload }
}

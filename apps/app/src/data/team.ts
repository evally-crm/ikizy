import { useCallback, useEffect, useState } from 'react'
import { useAuth, type MemberRole } from '../auth/AuthProvider'
import { isNeonConfigured, neon } from '../lib/neon'
import { canManageMembers } from '../lib/permissions'
import { useAgenda } from './AgendaProvider'

export interface TeamProfessional {
  id: string
  name: string
  title: string
  active: boolean
  /** conta ligada (a pessoa entra no sistema com o próprio login) */
  userId: string | null
}

export interface TeamMember {
  userId: string
  role: MemberRole
  name: string | null
}

export interface TeamInvite {
  id: string
  token: string
  role: Exclude<MemberRole, 'owner'>
  name: string
  professionalId: string | null
  expiresAt: Date
}

export interface InviteInput {
  role: Exclude<MemberRole, 'owner'>
  name: string
  professionalId: string | null
}

function friendly(error: { message: string; hint?: string; code?: string }) {
  if (error.hint === 'plan_professional_limit' || error.message.includes('limite de profissionais')) {
    return 'Seu plano chegou ao limite de profissionais ativas. Mude de plano em Assinatura para ter mais.'
  }
  if (error.code === '42501' || error.message.includes('row-level security')) return 'Você não tem permissão para fazer isso.'
  return 'Não foi possível salvar agora. Tente novamente.'
}

const demoToken = () => Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

/** equipe do salão: profissionais da agenda, quem tem acesso ao sistema e convites em aberto */
export function useTeam() {
  const { salon, session, displayName } = useAuth()
  const agenda = useAgenda()
  const live = isNeonConfigured && !!neon && !!salon
  const salonId = salon?.id
  const isOwner = canManageMembers(salon?.role)
  const me = session?.user.id ?? 'demo-owner'

  const [professionals, setProfessionals] = useState<TeamProfessional[]>(() =>
    live ? [] : agenda.professionals.map((p, i) => ({ id: p.id, name: p.name, title: p.role, active: true, userId: i === 0 ? 'demo-owner' : null })),
  )
  const [members, setMembers] = useState<TeamMember[]>(() => (live ? [] : [{ userId: 'demo-owner', role: 'owner', name: displayName }]))
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!live || !neon || !salonId) return
    const [pros, mems, invs] = await Promise.all([
      neon.from('professionals').select('id, name, title, active, user_id').eq('salon_id', salonId).order('name'),
      neon.from('members').select('user_id, role, name, created_at').eq('salon_id', salonId).order('created_at'),
      isOwner
        ? neon.from('invites').select('id, token, role, name, professional_id, expires_at').eq('salon_id', salonId).is('accepted_at', null).order('created_at')
        : Promise.resolve({ data: [], error: null }),
    ])
    if (pros.error || mems.error || invs.error) {
      setError('Não foi possível carregar a equipe. Recarregue a página.')
      setLoading(false)
      return
    }
    setProfessionals(
      (pros.data ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        title: (r.title as string) ?? '',
        active: r.active === true,
        userId: (r.user_id as string | null) ?? null,
      })),
    )
    setMembers((mems.data ?? []).map((r) => ({ userId: r.user_id as string, role: r.role as MemberRole, name: (r.name as string | null) ?? null })))
    setInvites(
      ((invs.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        token: r.token as string,
        role: r.role as TeamInvite['role'],
        name: r.name as string,
        professionalId: (r.professional_id as string | null) ?? null,
        expiresAt: new Date(r.expires_at as string),
      })),
    )
    setError(null)
    setLoading(false)
  }, [live, salonId, isOwner])

  useEffect(() => {
    void load()
  }, [load])

  /** depois de mexer em profissionais, a agenda também precisa da lista nova */
  const reloadAgenda = agenda.reload
  const afterProfessionalChange = useCallback(async () => {
    await load()
    reloadAgenda()
  }, [load, reloadAgenda])

  /** cadastra uma profissional nova e devolve o id (o convite pode ligar a conta a ela) */
  const addProfessional = useCallback(
    async (name: string, title: string): Promise<{ id: string } | { error: string }> => {
      const clean = name.trim()
      if (clean.length < 2) return { error: 'Informe o nome da profissional.' }
      if (!live || !neon || !salonId) {
        const id = `p-${Date.now()}`
        setProfessionals((list) => [...list, { id, name: clean, title: title.trim(), active: true, userId: null }])
        return { id }
      }
      const { data, error: err } = await neon
        .from('professionals')
        .insert({ salon_id: salonId, name: clean, title: title.trim() })
        .select('id')
        .single()
      if (err || !data) return { error: friendly(err ?? { message: '' }) }
      await afterProfessionalChange()
      return { id: data.id as string }
    },
    [live, salonId, afterProfessionalChange],
  )

  const saveProfessional = useCallback(
    async (id: string | null, name: string, title: string): Promise<string | null> => {
      if (!id) {
        const res = await addProfessional(name, title)
        return 'error' in res ? res.error : null
      }
      const clean = name.trim()
      if (clean.length < 2) return 'Informe o nome da profissional.'
      if (!live || !neon || !salonId) {
        setProfessionals((list) => list.map((p) => (p.id === id ? { ...p, name: clean, title: title.trim() } : p)))
        return null
      }
      const { error: err } = await neon.from('professionals').update({ name: clean, title: title.trim() }).eq('id', id).eq('salon_id', salonId)
      if (err) return friendly(err)
      await afterProfessionalChange()
      return null
    },
    [live, salonId, addProfessional, afterProfessionalChange],
  )

  const setProfessionalActive = useCallback(
    async (id: string, active: boolean): Promise<string | null> => {
      if (!live || !neon || !salonId) {
        setProfessionals((list) => list.map((p) => (p.id === id ? { ...p, active } : p)))
        return null
      }
      const { error: err } = await neon.from('professionals').update({ active }).eq('id', id).eq('salon_id', salonId)
      if (err) return friendly(err)
      await afterProfessionalChange()
      return null
    },
    [live, salonId, afterProfessionalChange],
  )

  /** cria o convite e devolve o token (para montar o link) */
  const createInvite = useCallback(
    async (input: InviteInput): Promise<{ token: string } | { error: string }> => {
      const name = input.name.trim()
      if (name.length < 2) return { error: 'Informe o nome de quem você está convidando.' }
      if (!live || !neon || !salonId) {
        const token = demoToken()
        setInvites((list) => [...list, { id: token, token, role: input.role, name, professionalId: input.professionalId, expiresAt: new Date(Date.now() + 7 * 864e5) }])
        return { token }
      }
      const { data, error: err } = await neon
        .from('invites')
        .insert({ salon_id: salonId, role: input.role, name, professional_id: input.professionalId })
        .select('token')
        .single()
      if (err || !data) return { error: friendly(err ?? { message: '' }) }
      await load()
      return { token: data.token as string }
    },
    [live, salonId, load],
  )

  const cancelInvite = useCallback(
    async (id: string): Promise<string | null> => {
      if (live && neon && salonId) {
        const { error: err } = await neon.from('invites').delete().eq('id', id).eq('salon_id', salonId)
        if (err) return friendly(err)
      }
      setInvites((list) => list.filter((i) => i.id !== id))
      return null
    },
    [live, salonId],
  )

  const changeRole = useCallback(
    async (userId: string, role: Exclude<MemberRole, 'owner'>): Promise<string | null> => {
      if (live && neon && salonId) {
        const { data, error: err } = await neon.from('members').update({ role }).eq('salon_id', salonId).eq('user_id', userId).select('user_id')
        if (err || !data?.length) return friendly(err ?? { message: 'row-level security' })
      }
      setMembers((list) => list.map((m) => (m.userId === userId ? { ...m, role } : m)))
      return null
    },
    [live, salonId],
  )

  const removeMember = useCallback(
    async (userId: string): Promise<string | null> => {
      if (live && neon && salonId) {
        const { data, error: err } = await neon.from('members').delete().eq('salon_id', salonId).eq('user_id', userId).select('user_id')
        if (err || !data?.length) return friendly(err ?? { message: 'row-level security' })
        await afterProfessionalChange()
      }
      setMembers((list) => list.filter((m) => m.userId !== userId))
      return null
    },
    [live, salonId, afterProfessionalChange],
  )

  return {
    loading,
    error,
    me,
    isOwner,
    professionals,
    members,
    invites,
    addProfessional,
    saveProfessional,
    setProfessionalActive,
    createInvite,
    cancelInvite,
    changeRole,
    removeMember,
  }
}

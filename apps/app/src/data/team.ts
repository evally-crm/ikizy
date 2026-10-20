import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useSubscription } from '../billing/SubscriptionProvider'
import { isNeonConfigured, neon } from '../lib/neon'
import { isPlanId, type PlanId } from '../lib/plans'
import type { Role } from '../domain/team'
import { professionals as mockProfessionals } from './mock'

/**
 * Equipe (Meu negócio → Equipe): profissionais da agenda, acessos com login e convites em aberto.
 * Lê tudo de uma vez pela função get_team() (só dona e gerente); cada ação grava na hora.
 * No modo demonstração tudo fica em memória.
 */

export interface TeamProfessional {
  id: string
  name: string
  title: string
  commissionPct: number
  active: boolean
  userId: string | null
}

export interface TeamMember {
  userId: string
  role: Role
  name: string
  email: string
  since: Date
  professionalId: string | null
}

export interface TeamInvite {
  id: string
  token: string
  role: Role
  professionalId: string | null
  createdAt: Date
  expiresAt: Date
}

export interface ProfessionalInput {
  name: string
  title: string
  commissionPct: number
}

interface TeamRow {
  plan: string
  professionals: { id: string; name: string; title: string; commission_pct: number | string; active: boolean; user_id: string | null }[]
  members: { user_id: string; role: Role; name: string | null; email: string | null; since: string; professional_id: string | null }[]
  invites: { id: string; token: string; role: Role; professional_id: string | null; created_at: string; expires_at: string }[]
}

/** erros do banco -> frase para a tela */
function friendly(error: { code?: string; message: string }): string {
  const m = error.message
  if (m.includes('plan_limit_professionals')) return 'Seu plano chegou ao limite de profissionais ativas.'
  if (m.includes('plan_limit_members')) return 'Seu plano chegou ao limite de acessos com login.'
  if (m.includes('plan_role')) return 'Gerente e recepção fazem parte do plano Salão.'
  if (m.includes('professional_has_access')) return 'Essa profissional já tem acesso.'
  if (m.includes('professional_not_linked')) return 'O perfil profissional precisa estar ligado a alguém da agenda.'
  if (m.includes('sem assinatura')) return 'Seu acesso terminou. Escolha um plano para voltar a editar.'
  if (error.code === '42501' || m.includes('row-level security')) return 'Só a dona ou a gerente podem fazer isso.'
  return 'Não foi possível salvar agora. Tente novamente.'
}

const DEMO_OWNER = 'demo-owner'

function demoTeam(): { professionals: TeamProfessional[]; members: TeamMember[] } {
  return {
    professionals: mockProfessionals.map((p, i) => ({ id: p.id, name: p.name, title: p.role, commissionPct: i === 0 ? 0 : 40, active: true, userId: i === 0 ? DEMO_OWNER : null })),
    members: [{ userId: DEMO_OWNER, role: 'owner', name: 'Maria Eduarda', email: 'voce@exemplo.com', since: new Date(), professionalId: mockProfessionals[0]?.id ?? null }],
  }
}

export function useTeam() {
  const { salon, session } = useAuth()
  const { sub } = useSubscription()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)

  const [plan, setPlan] = useState<PlanId>(live ? 'solo' : 'salao')
  const [professionals, setProfessionals] = useState<TeamProfessional[]>(() => (live ? [] : demoTeam().professionals))
  const [members, setMembers] = useState<TeamMember[]>(() => (live ? [] : demoTeam().members))
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!live || !neon || !salonId) return
    let cancelled = false
    void (async () => {
      const { data, error: err } = await neon.rpc('get_team', { p_salon: salonId })
      if (cancelled) return
      if (err || !data) {
        setError('Não foi possível carregar a equipe. Verifique a conexão e tente de novo.')
        setLoading(false)
        return
      }
      const row = data as TeamRow
      setError(null)
      setPlan(isPlanId(row.plan) ? row.plan : 'solo')
      setProfessionals(
        row.professionals.map((p) => ({ id: p.id, name: p.name, title: p.title, commissionPct: Number(p.commission_pct), active: p.active, userId: p.user_id })),
      )
      setMembers(
        row.members.map((m) => ({
          userId: m.user_id,
          role: m.role,
          name: m.name?.trim() || m.email || 'Sem nome',
          email: m.email ?? '',
          since: new Date(m.since),
          professionalId: m.professional_id,
        })),
      )
      setInvites(
        row.invites.map((i) => ({
          id: i.id,
          token: i.token,
          role: i.role,
          professionalId: i.professional_id,
          createdAt: new Date(i.created_at),
          expiresAt: new Date(i.expires_at),
        })),
      )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [live, salonId, tick])

  // o plano da tela segue a assinatura quando ela muda (troca de plano em outra aba)
  useEffect(() => {
    if (sub && live) setPlan(sub.plan)
  }, [sub, live])

  /** cria (sem id) ou edita uma profissional */
  const saveProfessional = useCallback(
    async (input: ProfessionalInput, id?: string): Promise<string | null> => {
      const name = input.name.trim()
      if (name.length < 2) return 'Informe o nome da profissional.'
      const pct = Math.min(100, Math.max(0, Math.round(input.commissionPct * 100) / 100))
      const cols = { name, title: input.title.trim(), commission_pct: pct }
      if (live && neon && salonId) {
        const res = id
          ? await neon.from('professionals').update(cols).eq('id', id).eq('salon_id', salonId).select('id')
          : await neon.from('professionals').insert({ ...cols, salon_id: salonId }).select('id')
        if (res.error) return friendly(res.error)
        if (!res.data?.length) return 'Só a dona ou a gerente podem fazer isso.'
        reload()
        return null
      }
      setProfessionals((list) =>
        id
          ? list.map((p) => (p.id === id ? { ...p, name, title: cols.title, commissionPct: pct } : p))
          : [...list, { id: `p-${Date.now()}`, name, title: cols.title, commissionPct: pct, active: true, userId: null }],
      )
      return null
    },
    [live, salonId, reload],
  )

  /** desativar tira da agenda e do site, o histórico fica (R-22) */
  const setActive = useCallback(
    async (id: string, active: boolean): Promise<string | null> => {
      if (live && neon && salonId) {
        const { data, error: err } = await neon.from('professionals').update({ active }).eq('id', id).eq('salon_id', salonId).select('id')
        if (err) return friendly(err)
        if (!data?.length) return 'Só a dona ou a gerente podem fazer isso.'
        reload()
        return null
      }
      setProfessionals((list) => list.map((p) => (p.id === id ? { ...p, active } : p)))
      return null
    },
    [live, salonId, reload],
  )

  /** gera o convite e devolve o token (para montar o link) */
  const invite = useCallback(
    async (role: Role, professionalId: string | null): Promise<{ token: string } | { error: string }> => {
      if (live && neon && salonId) {
        const { data, error: err } = await neon.rpc('create_invite', { p_salon: salonId, p_role: role, p_professional: professionalId })
        if (err || typeof data !== 'string') return { error: friendly(err ?? { message: '' }) }
        reload()
        return { token: data }
      }
      const token = Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
      const now = new Date()
      setInvites((list) => [
        { id: token.slice(0, 8), token, role, professionalId, createdAt: now, expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        ...list.filter((i) => !professionalId || i.professionalId !== professionalId),
      ])
      return { token }
    },
    [live, salonId, reload],
  )

  const revokeInvite = useCallback(
    async (id: string): Promise<string | null> => {
      if (live && neon) {
        const { error: err } = await neon.rpc('revoke_invite', { p_invite: id })
        if (err) return friendly(err)
        reload()
        return null
      }
      setInvites((list) => list.filter((i) => i.id !== id))
      return null
    },
    [live, reload],
  )

  /** tira o login na hora; a profissional continua na agenda (R-25) */
  const removeAccess = useCallback(
    async (userId: string): Promise<string | null> => {
      if (live && neon && salonId) {
        const { error: err } = await neon.rpc('remove_member', { p_salon: salonId, p_user: userId })
        if (err) return friendly(err)
        reload()
        return null
      }
      setMembers((list) => list.filter((m) => m.userId !== userId))
      setProfessionals((list) => list.map((p) => (p.userId === userId ? { ...p, userId: null } : p)))
      return null
    },
    [live, salonId, reload],
  )

  const changeRole = useCallback(
    async (userId: string, role: Role): Promise<string | null> => {
      if (live && neon && salonId) {
        const { error: err } = await neon.rpc('set_member_role', { p_salon: salonId, p_user: userId, p_role: role })
        if (err) return friendly(err)
        reload()
        return null
      }
      setMembers((list) => list.map((m) => (m.userId === userId ? { ...m, role } : m)))
      return null
    },
    [live, salonId, reload],
  )

  return {
    loading,
    error,
    plan,
    professionals,
    members,
    invites,
    /** id da pessoa logada (para não oferecer "remover" a si mesma) */
    myUserId: live ? (session?.user.id ?? null) : DEMO_OWNER,
    reload,
    saveProfessional,
    setActive,
    invite,
    revokeInvite,
    removeAccess,
    changeRole,
  }
}

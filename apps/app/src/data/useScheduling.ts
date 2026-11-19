import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { isNeonConfigured, neon } from '../lib/neon'
import { upcomingBlocks, type BlockValue, type TimeBlock } from '../domain/schedule'

const denied = (r: { error: { code?: string; message: string } | null }) =>
  r.error && (r.error.code === '42501' || r.error.message.includes('row-level security'))
    ? 'Só a dona ou a gerente alteram os bloqueios e o intervalo.'
    : 'Não foi possível salvar agora. Tente novamente.'

/**
 * Bloqueios de horário (folga, férias, almoço extra) e intervalo entre atendimentos do negócio.
 * Só dona e gerente alteram (a política do banco garante); todos os membros leem.
 * Sem banco (modo demonstração) os dados ficam só na tela.
 */
export function useScheduling() {
  const { salon } = useAuth()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [buffer, setBufferState] = useState(0)
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!live || !neon || !salonId) return
    let cancelled = false
    void (async () => {
      const [b, s] = await Promise.all([
        neon.from('time_blocks').select('id, professional_id, starts_at, ends_at, reason').eq('salon_id', salonId).gt('ends_at', new Date().toISOString()).order('starts_at').limit(200),
        neon.from('salons').select('buffer_minutes').eq('id', salonId).maybeSingle(),
      ])
      if (cancelled) return
      if (b.error || s.error) {
        // a migration pode não existir ainda neste ambiente: o resto da tela continua funcionando
        setError('Não foi possível carregar os bloqueios. Verifique a conexão e tente de novo.')
        setLoading(false)
        return
      }
      setBlocks(
        upcomingBlocks(
          (b.data ?? []).map((x) => ({
            id: x.id as string,
            professionalId: (x.professional_id as string | null) ?? null,
            startsAt: x.starts_at as string,
            endsAt: x.ends_at as string,
            reason: (x.reason as string) ?? '',
          })),
        ),
      )
      setBufferState(Number((s.data as { buffer_minutes?: number } | null)?.buffer_minutes ?? 0))
      setError(null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [live, salonId])

  /** devolve a mensagem de erro, ou null se deu certo */
  const addBlock = useCallback(
    async (value: BlockValue): Promise<string | null> => {
      if (!live || !neon || !salonId) {
        setBlocks((list) => upcomingBlocks([...list, { id: `demo-${Date.now()}`, ...value }]))
        return null
      }
      const r = await neon
        .from('time_blocks')
        .insert({ salon_id: salonId, professional_id: value.professionalId, starts_at: value.startsAt, ends_at: value.endsAt, reason: value.reason })
        .select('id')
        .single()
      if (r.error || !r.data) return denied(r as { error: { code?: string; message: string } | null })
      setBlocks((list) => upcomingBlocks([...list, { id: r.data.id as string, ...value }]))
      return null
    },
    [live, salonId],
  )

  const removeBlock = useCallback(
    async (id: string): Promise<string | null> => {
      if (!live || !neon) {
        setBlocks((list) => list.filter((x) => x.id !== id))
        return null
      }
      const r = await neon.from('time_blocks').delete().eq('id', id)
      if (r.error) return denied(r)
      setBlocks((list) => list.filter((x) => x.id !== id))
      return null
    },
    [live],
  )

  const setBuffer = useCallback(
    async (minutes: number): Promise<string | null> => {
      const before = buffer
      setBufferState(minutes)
      if (!live || !neon || !salonId) return null
      const r = await neon.from('salons').update({ buffer_minutes: minutes }).eq('id', salonId)
      if (r.error) {
        setBufferState(before)
        return denied(r)
      }
      return null
    },
    [live, salonId, buffer],
  )

  return { blocks, buffer, loading, error, addBlock, removeBlock, setBuffer }
}

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { isNeonConfigured, neon } from '../lib/neon'
import { firstNameOf, newestFirst, type ReviewItem } from '../domain/site'

/**
 * Avaliações das clientes (vêm da página do pedido). Esconder tira do site na hora, sem Publicar:
 * o site lê direto do banco. Só dona e gerente alteram (a política do banco garante).
 */
export function useReviews() {
  const { salon } = useAuth()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!live || !neon || !salonId) return
    let cancelled = false
    void (async () => {
      const r = await neon
        .from('reviews')
        .select('id, rating, comment, hidden, created_at, service_name, clients(name)')
        .eq('salon_id', salonId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (cancelled) return
      if (r.error) {
        setError('Não foi possível carregar as avaliações. Verifique a conexão e tente de novo.')
        setLoading(false)
        return
      }
      setItems(
        newestFirst(
          (r.data ?? []).map((x) => {
            const c = x.clients as { name?: string } | { name?: string }[] | null
            const name = Array.isArray(c) ? c[0]?.name : c?.name
            return {
              id: x.id as string,
              rating: Number(x.rating),
              comment: (x.comment as string) ?? '',
              hidden: Boolean(x.hidden),
              createdAt: x.created_at as string,
              service: (x.service_name as string) ?? '',
              firstName: firstNameOf(name),
            }
          }),
        ),
      )
      setError(null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [live, salonId])

  /** devolve a mensagem de erro, ou null se deu certo */
  const setHidden = useCallback(
    async (id: string, hidden: boolean): Promise<string | null> => {
      if (!live || !neon) return null
      const before = items
      setItems((list) => list.map((x) => (x.id === id ? { ...x, hidden } : x)))
      const r = await neon.from('reviews').update({ hidden }).eq('id', id)
      if (r.error) {
        setItems(before)
        return r.error.code === '42501' || r.error.message.includes('row-level security')
          ? 'Só quem é dona ou gerente pode esconder avaliações.'
          : 'Não foi possível salvar agora. Tente novamente.'
      }
      return null
    },
    [live, items],
  )

  return { items, loading, error, setHidden }
}

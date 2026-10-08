import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { neon } from '../lib/neon'

/** nome do salão e link do site (só quando publicado), usados nas mensagens prontas */
export function useSalonInfo() {
  const { salon, status } = useAuth()
  const [published, setPublished] = useState(status === 'demo')

  useEffect(() => {
    if (!neon || !salon?.id) return
    let cancelled = false
    void neon
      .from('site_settings')
      .select('published')
      .eq('salon_id', salon.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPublished(Boolean((data as { published?: boolean } | null)?.published))
      })
    return () => {
      cancelled = true
    }
  }, [salon?.id])

  return {
    salonName: salon?.name ?? 'Studio Maria Beauty',
    siteUrl: published && salon?.slug ? `https://${salon.slug}.ikizy.com` : undefined,
  }
}

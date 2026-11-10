import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { neon } from '../lib/neon'

/** nome do salão, link do site (só quando publicado) e endereço, usados nas mensagens prontas */
export function useSalonInfo() {
  const { salon, status } = useAuth()
  const [published, setPublished] = useState(status === 'demo')
  const [address, setAddress] = useState(status === 'demo' ? 'Rua das Flores, 120 · Centro' : '')

  useEffect(() => {
    if (!neon || !salon?.id) return
    let cancelled = false
    void neon
      .from('site_settings')
      .select('published, address')
      .eq('salon_id', salon.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const row = data as { published?: boolean; address?: string | null } | null
        setPublished(Boolean(row?.published))
        setAddress(row?.address?.trim() ?? '')
      })
    return () => {
      cancelled = true
    }
  }, [salon?.id])

  return {
    salonName: salon?.name ?? 'Studio Maria Beauty',
    siteUrl: published && salon?.slug ? `https://${salon.slug}.ikizy.com` : undefined,
    address: address || undefined,
  }
}

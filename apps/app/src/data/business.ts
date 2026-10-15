import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { isNeonConfigured, neon } from '../lib/neon'
import { DEFAULT_STUDIO, newId, type Category, type Product, type Service, type Studio } from './catalog'

/**
 * "Meu negócio": dados do negócio, serviços e custos de material, gravados na hora (sem passar pelo "Publicar" do site).
 * No modo demonstração usa o mesmo rascunho do Meu site guardado no navegador, para as duas telas conversarem.
 */

export interface BusinessDetails {
  name: string
  whatsapp: string
  instagram: string
  address: string
}

/** serviço editável aqui: o que é do negócio (o que aparece no site fica no Meu site) */
export type ServiceInput = Pick<Service, 'name' | 'category' | 'price' | 'duration' | 'monthlyVolume' | 'productId'>

const STORAGE_KEY = 'ikizy:studio:v1'

function readDemo(): Studio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_STUDIO, ...(JSON.parse(raw) as Studio) } : DEFAULT_STUDIO
  } catch {
    return DEFAULT_STUDIO
  }
}

function writeDemo(studio: Studio) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studio))
  } catch {
    // sem armazenamento: vale só nesta visita
  }
}

const friendly = (error: { code?: string; message: string }) => {
  if (error.code === '42501' || error.message.includes('row-level security')) return 'Só quem é dona ou gerente pode alterar isso.'
  if (error.message.includes('has_access')) return 'Seu acesso terminou. Escolha um plano para voltar a editar.'
  return 'Não foi possível salvar agora. Tente novamente.'
}

export function useBusiness() {
  const { salon } = useAuth()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)

  const [details, setDetails] = useState<BusinessDetails>(() => {
    const d = readDemo()
    return { name: salon?.name ?? d.site.salonName, whatsapp: live ? '' : d.site.whatsapp, instagram: live ? '' : d.site.instagram, address: live ? '' : d.site.address }
  })
  const [services, setServices] = useState<Service[]>(() => (live ? [] : readDemo().services))
  const [products, setProducts] = useState<Product[]>(() => (live ? [] : readDemo().products))
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!live || !neon || !salonId) return
    let cancelled = false
    void (async () => {
      const [sal, st, svcs, prods] = await Promise.all([
        neon.from('salons').select('name').eq('id', salonId).maybeSingle(),
        neon.from('site_settings').select('whatsapp, instagram, address').eq('salon_id', salonId).maybeSingle(),
        neon
          .from('services')
          .select('id, name, category, price, duration, monthly_volume, product_id, visible, photo_id')
          .eq('salon_id', salonId)
          .order('created_at'),
        neon.from('products').select('id, name, monthly_spend').eq('salon_id', salonId).order('created_at'),
      ])
      if (cancelled) return
      if (sal.error || st.error || svcs.error || prods.error) {
        setError('Não foi possível carregar os dados do negócio. Verifique a conexão e tente de novo.')
        setLoading(false)
        return
      }
      setDetails({
        name: (sal.data?.name as string) ?? '',
        whatsapp: (st.data?.whatsapp as string) ?? '',
        instagram: (st.data?.instagram as string) ?? '',
        address: (st.data?.address as string) ?? '',
      })
      setServices(
        (svcs.data ?? []).map((s) => ({
          id: s.id as string,
          name: s.name as string,
          category: s.category as Category,
          price: Number(s.price),
          duration: s.duration as number,
          monthlyVolume: s.monthly_volume as number,
          productId: (s.product_id as string | null) ?? null,
          visible: s.visible as boolean,
          photo: '',
          photoId: (s.photo_id as string | null) ?? null,
        })),
      )
      setProducts((prods.data ?? []).map((p) => ({ id: p.id as string, name: p.name as string, monthlySpend: Number(p.monthly_spend) })))
      setError(null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [live, salonId, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  /** nome, WhatsApp, Instagram e endereço: o site lê daqui */
  const saveDetails = useCallback(
    async (next: BusinessDetails): Promise<string | null> => {
      const name = next.name.trim()
      if (name.length < 2) return 'O nome do negócio precisa ter pelo menos 2 caracteres.'
      const clean = { whatsapp: next.whatsapp.trim(), instagram: next.instagram.trim(), address: next.address.trim().slice(0, 120) }
      if (live && neon && salonId) {
        const sal = await neon.from('salons').update({ name }).eq('id', salonId).select('id')
        if (sal.error) return friendly(sal.error)
        if (!sal.data?.length) return 'Só quem é dona ou gerente pode alterar isso.'
        const st = await neon.from('site_settings').update(clean).eq('salon_id', salonId).select('salon_id')
        if (st.error) return friendly(st.error)
      } else {
        const d = readDemo()
        writeDemo({ ...d, site: { ...d.site, salonName: name, ...clean } })
      }
      setDetails({ name, ...clean })
      return null
    },
    [live, salonId],
  )

  /** cria (sem `id`) ou altera um serviço */
  const saveService = useCallback(
    async (input: ServiceInput, id?: string): Promise<string | null> => {
      const name = input.name.trim().replace(/\s+/g, ' ')
      if (name.length < 2) return 'Dê um nome ao serviço.'
      const fields = {
        name: name.slice(0, 80),
        category: input.category,
        price: Math.max(0, input.price),
        duration: Math.min(600, Math.max(5, Math.round(input.duration / 5) * 5)),
        monthly_volume: Math.max(0, Math.round(input.monthlyVolume)),
        product_id: input.productId,
      }
      if (live && neon && salonId) {
        if (id) {
          const r = await neon.from('services').update(fields).eq('id', id).eq('salon_id', salonId).select('id')
          if (r.error) return friendly(r.error)
          if (!r.data?.length) return 'Só quem é dona ou gerente pode alterar isso.'
          setServices((list) => list.map((s) => (s.id === id ? { ...s, ...input, name: fields.name, duration: fields.duration } : s)))
        } else {
          const r = await neon.from('services').insert({ ...fields, salon_id: salonId, visible: true }).select('id').single()
          if (r.error || !r.data) return friendly(r.error ?? { message: '' })
          setServices((list) => [...list, { ...input, name: fields.name, duration: fields.duration, id: r.data.id as string, visible: true, photo: '', photoId: null }])
        }
        return null
      }
      const d = readDemo()
      const list = id
        ? d.services.map((s) => (s.id === id ? { ...s, ...input, name: fields.name, duration: fields.duration } : s))
        : [...d.services, { ...input, name: fields.name, duration: fields.duration, id: newId('s'), visible: true, photo: '', photoId: null }]
      writeDemo({ ...d, services: list })
      setServices(list)
      return null
    },
    [live, salonId],
  )

  /** atendimentos já feitos guardam o nome do serviço: apagar não muda o histórico */
  const removeService = useCallback(
    async (id: string): Promise<string | null> => {
      if (live && neon && salonId) {
        const r = await neon.from('services').delete().eq('id', id).eq('salon_id', salonId).select('id')
        if (r.error) return friendly(r.error)
        if (!r.data?.length) return 'Só quem é dona ou gerente pode alterar isso.'
      } else {
        const d = readDemo()
        writeDemo({ ...d, services: d.services.filter((s) => s.id !== id) })
      }
      setServices((list) => list.filter((s) => s.id !== id))
      return null
    },
    [live, salonId],
  )

  /** custo de material (gasto médio por mês); cria sem `id` */
  const saveProduct = useCallback(
    async (input: Pick<Product, 'name' | 'monthlySpend'>, id?: string): Promise<string | null> => {
      const name = input.name.trim()
      if (name.length < 1) return 'Dê um nome ao material.'
      const fields = { name: name.slice(0, 80), monthly_spend: Math.max(0, input.monthlySpend) }
      if (live && neon && salonId) {
        if (id) {
          const r = await neon.from('products').update(fields).eq('id', id).eq('salon_id', salonId).select('id')
          if (r.error) return friendly(r.error)
          if (!r.data?.length) return 'Só quem é dona ou gerente pode alterar isso.'
          setProducts((list) => list.map((p) => (p.id === id ? { ...p, name: fields.name, monthlySpend: fields.monthly_spend } : p)))
        } else {
          const r = await neon.from('products').insert({ ...fields, salon_id: salonId }).select('id').single()
          if (r.error || !r.data) return friendly(r.error ?? { message: '' })
          setProducts((list) => [...list, { id: r.data.id as string, name: fields.name, monthlySpend: fields.monthly_spend }])
        }
        return null
      }
      const d = readDemo()
      const list = id
        ? d.products.map((p) => (p.id === id ? { ...p, name: fields.name, monthlySpend: fields.monthly_spend } : p))
        : [...d.products, { id: newId('p'), name: fields.name, monthlySpend: fields.monthly_spend }]
      writeDemo({ ...d, products: list })
      setProducts(list)
      return null
    },
    [live, salonId],
  )

  /** os serviços que usavam o material ficam sem ele (o banco limpa a ligação sozinho) */
  const removeProduct = useCallback(
    async (id: string): Promise<string | null> => {
      if (live && neon && salonId) {
        const r = await neon.from('products').delete().eq('id', id).eq('salon_id', salonId).select('id')
        if (r.error) return friendly(r.error)
        if (!r.data?.length) return 'Só quem é dona ou gerente pode alterar isso.'
      } else {
        const d = readDemo()
        writeDemo({ ...d, products: d.products.filter((p) => p.id !== id), services: d.services.map((s) => (s.productId === id ? { ...s, productId: null } : s)) })
      }
      setProducts((list) => list.filter((p) => p.id !== id))
      setServices((list) => list.map((s) => (s.productId === id ? { ...s, productId: null } : s)))
      return null
    },
    [live, salonId],
  )

  return { details, services, products, loading, error, reload, saveDetails, saveService, removeService, saveProduct, removeProduct }
}

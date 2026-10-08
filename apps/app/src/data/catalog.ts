import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { isNeonConfigured, neon } from '../lib/neon'

export { ACCENTS, CATEGORIES } from '../lib/siteTheme'
export type { AccentId, Category } from '../lib/siteTheme'
import type { AccentId, Category } from '../lib/siteTheme'

export interface Product {
  id: string
  name: string
  /** gasto médio por mês com o produto, em reais */
  monthlySpend: number
}

export interface Service {
  id: string
  name: string
  category: Category
  price: number
  duration: number
  /** atendimentos feitos por mês, em média */
  monthlyVolume: number
  productId: string | null
  visible: boolean
}

export interface SiteConfig {
  slug: string
  salonName: string
  tagline: string
  about: string
  whatsapp: string
  instagram: string
  hours: string
  accent: AccentId
  /** cor própria (#rrggbb); vazia = usa a cor da lista */
  accentColor: string
  /** logo reduzido, como data URL; vazio = sem logo */
  logo: string
  /** foto de capa do topo do site, como data URL; vazio = sem foto */
  cover: string
  /** endereço do salão, com link para o mapa */
  address: string
  showPrices: boolean
  showTeam: boolean
  depositPercent: number
}

export interface Studio {
  site: SiteConfig
  services: Service[]
  products: Product[]
}

export const DEFAULT_STUDIO: Studio = {
  site: {
    slug: 'studio-maria-beauty',
    salonName: 'Studio Maria Beauty',
    tagline: 'Cuidado de verdade, do esmalte ao olhar.',
    about:
      'Um espaço pequeno, acolhedor e feito para você relaxar. Unhas, cílios, sobrancelhas e cabelo com atendimento no horário e produtos de qualidade.',
    whatsapp: '(11) 98765-0000',
    instagram: '@studiomariabeauty',
    hours: 'Seg a Sáb · 09h às 19h',
    accent: 'bordo',
    accentColor: '',
    logo: '',
    cover: '',
    address: '',
    showPrices: true,
    showTeam: true,
    depositPercent: 20,
  },
  products: [
    { id: 'p-gel', name: 'Gel construtor e esmaltes', monthlySpend: 840 },
    { id: 'p-cilios', name: 'Fios e cola de cílios', monthlySpend: 620 },
    { id: 'p-cabelo', name: 'Coloração e tratamentos', monthlySpend: 1260 },
    { id: 'p-sobr', name: 'Henna e linha de design', monthlySpend: 180 },
  ],
  services: [
    { id: 's1', name: 'Alongamento em gel', category: 'Unhas', price: 220, duration: 120, monthlyVolume: 28, productId: 'p-gel', visible: true },
    { id: 's2', name: 'Esmaltação em gel', category: 'Unhas', price: 90, duration: 60, monthlyVolume: 44, productId: 'p-gel', visible: true },
    { id: 's3', name: 'Nail art', category: 'Unhas', price: 110, duration: 60, monthlyVolume: 16, productId: 'p-gel', visible: true },
    { id: 's4', name: 'Fio a fio', category: 'Cílios', price: 260, duration: 120, monthlyVolume: 20, productId: 'p-cilios', visible: true },
    { id: 's5', name: 'Lash lifting', category: 'Cílios', price: 180, duration: 75, monthlyVolume: 14, productId: 'p-cilios', visible: true },
    { id: 's6', name: 'Design de sobrancelha', category: 'Sobrancelha', price: 70, duration: 45, monthlyVolume: 38, productId: 'p-sobr', visible: true },
    { id: 's7', name: 'Coloração', category: 'Cabelo', price: 380, duration: 150, monthlyVolume: 12, productId: 'p-cabelo', visible: true },
    { id: 's8', name: 'Hidratação profunda', category: 'Cabelo', price: 130, duration: 60, monthlyVolume: 18, productId: 'p-cabelo', visible: false },
  ],
}

export interface ServiceMath {
  /** custo de produto por atendimento */
  cost: number
  margin: number
  marginPct: number
}

/** o gasto mensal do produto é dividido entre todos os atendimentos que o usam */
export function computeMath(service: Service, services: Service[], products: Product[]): ServiceMath {
  const product = products.find((p) => p.id === service.productId)
  let cost = 0
  if (product) {
    const volume = services.filter((s) => s.productId === product.id).reduce((sum, s) => sum + s.monthlyVolume, 0)
    cost = volume > 0 ? product.monthlySpend / volume : 0
  }
  const margin = service.price - cost
  return { cost, margin, marginPct: service.price > 0 ? Math.round((margin / service.price) * 100) : 0 }
}

const STORAGE_KEY = 'ikizy:studio:v1'

function load(): Studio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_STUDIO, ...JSON.parse(raw) }
  } catch {
    /* sem storage: segue com o padrão */
  }
  return DEFAULT_STUDIO
}

export const newId = (prefix: string) =>
  `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/** site novo: sem textos de exemplo, só o nome e o endereço do negócio */
const blankStudio = (name: string, slug: string): Studio => ({
  site: { ...DEFAULT_STUDIO.site, slug, salonName: name, tagline: '', about: '', whatsapp: '', instagram: '', hours: '', logo: '', cover: '', address: '' },
  services: [],
  products: [],
})

interface SettingsRow {
  tagline: string
  about: string
  whatsapp: string
  instagram: string
  hours: string
  accent: AccentId
  accent_color?: string | null
  logo?: string | null
  cover?: string | null
  address?: string
  show_prices: boolean
  show_team: boolean
  deposit_percent: number
  published?: boolean
}

function friendlyPublishError(error: { code?: string; message: string }) {
  if (error.code === '23505' || error.message.includes('salons_slug_key')) return 'Esse endereço já está em uso. Escolha outro.'
  if (error.message.includes('salons_slug_not_reserved')) return 'Esse endereço é reservado. Escolha outro.'
  if (error.code === '42501' || error.message.includes('row-level security')) return 'Só quem é dona ou gerente pode publicar o site.'
  return 'Não foi possível publicar agora. Tente novamente.'
}

/** rascunho editável + versão publicada (no Neon; em modo demonstração, no navegador) */
export function useStudio() {
  const { salon } = useAuth()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)

  const [published, setPublished] = useState<Studio>(() => (live ? blankStudio(salon?.name ?? '', salon?.slug ?? '') : load()))
  const [draft, setDraft] = useState<Studio>(published)
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)
  /** true depois do primeiro "Publicar": só então a página pública existe */
  const [isLive, setIsLive] = useState(!live)
  const saving = useRef(false)

  useEffect(() => {
    if (!live || !neon || !salonId) return
    let cancelled = false
    void (async () => {
      const [settings, svcs, prods, salonRow] = await Promise.all([
        neon.from('site_settings').select('*').eq('salon_id', salonId).maybeSingle(),
        neon
          .from('services')
          .select('id, name, category, price, duration, monthly_volume, product_id, visible')
          .eq('salon_id', salonId)
          .order('created_at'),
        neon.from('products').select('id, name, monthly_spend').eq('salon_id', salonId).order('created_at'),
        neon.from('salons').select('name, slug').eq('id', salonId).maybeSingle(),
      ])
      if (cancelled) return
      if (settings.error || svcs.error || prods.error || salonRow.error || !salonRow.data) {
        setError('Não foi possível carregar o seu site. Verifique a conexão e tente de novo.')
        setLoading(false)
        return
      }
      const row = settings.data as unknown as SettingsRow | null
      const base = blankStudio(salonRow.data.name as string, salonRow.data.slug as string)
      const studio: Studio = {
        site: row
          ? {
              ...base.site,
              tagline: row.tagline,
              about: row.about,
              whatsapp: row.whatsapp,
              instagram: row.instagram,
              hours: row.hours,
              accent: row.accent,
              accentColor: row.accent_color ?? '',
              logo: row.logo ?? '',
              cover: row.cover ?? '',
              address: row.address ?? '',
              showPrices: row.show_prices,
              showTeam: row.show_team,
              depositPercent: row.deposit_percent,
            }
          : base.site,
        products: (prods.data ?? []).map((p) => ({ id: p.id as string, name: p.name as string, monthlySpend: Number(p.monthly_spend) })),
        services: (svcs.data ?? []).map((s) => ({
          id: s.id as string,
          name: s.name as string,
          category: s.category as Category,
          price: Number(s.price),
          duration: s.duration as number,
          monthlyVolume: s.monthly_volume as number,
          productId: (s.product_id as string | null) ?? null,
          visible: s.visible as boolean,
        })),
      }
      setPublished(studio)
      setDraft(studio)
      setIsLive(Boolean(row?.published))
      setError(null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [live, salonId])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(published), [draft, published])

  /** devolve a mensagem de erro, ou null quando publicou */
  const publish = useCallback(async (): Promise<string | null> => {
    if (!live || !neon || !salonId) {
      setPublished(draft)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
      } catch {
        /* ignora */
      }
      return null
    }
    if (saving.current) return null
    saving.current = true
    try {
      const { site } = draft
      const name = site.salonName.trim()
      if (name.length < 2) return 'O nome do salão precisa ter pelo menos 2 caracteres.'
      if (site.slug.length < 3) return 'O endereço precisa ter pelo menos 3 caracteres.'

      // 1) nome e endereço do negócio
      const sal = await neon.from('salons').update({ name, slug: site.slug }).eq('id', salonId).select('id')
      if (sal.error) return friendlyPublishError(sal.error)
      if (!sal.data?.length) return 'Só quem é dona ou gerente pode publicar o site.'

      // 2) produtos: os novos entram sem id (o banco gera) e o rascunho passa a usar o id real
      const productIds = new Map<string, string>()
      for (const p of draft.products) {
        const fields = { name: p.name.trim() || 'Produto', monthly_spend: p.monthlySpend }
        if (isUuid(p.id)) {
          const r = await neon.from('products').update(fields).eq('id', p.id).eq('salon_id', salonId)
          if (r.error) return friendlyPublishError(r.error)
          productIds.set(p.id, p.id)
        } else {
          const r = await neon.from('products').insert({ ...fields, salon_id: salonId }).select('id').single()
          if (r.error || !r.data) return friendlyPublishError(r.error ?? { message: '' })
          productIds.set(p.id, r.data.id as string)
        }
      }
      const keepProducts = [...productIds.values()]
      const oldProducts = published.products.map((p) => p.id).filter((id) => !keepProducts.includes(id))
      if (oldProducts.length) {
        const r = await neon.from('products').delete().in('id', oldProducts).eq('salon_id', salonId)
        if (r.error) return friendlyPublishError(r.error)
      }

      // 3) serviços
      const serviceIds = new Map<string, string>()
      for (const s of draft.services) {
        const fields = {
          name: s.name.trim() || 'Serviço',
          category: s.category,
          price: s.price,
          duration: Math.min(600, Math.max(5, s.duration)),
          monthly_volume: s.monthlyVolume,
          product_id: s.productId ? (productIds.get(s.productId) ?? null) : null,
          visible: s.visible,
        }
        if (isUuid(s.id)) {
          const r = await neon.from('services').update(fields).eq('id', s.id).eq('salon_id', salonId)
          if (r.error) return friendlyPublishError(r.error)
          serviceIds.set(s.id, s.id)
        } else {
          const r = await neon.from('services').insert({ ...fields, salon_id: salonId }).select('id').single()
          if (r.error || !r.data) return friendlyPublishError(r.error ?? { message: '' })
          serviceIds.set(s.id, r.data.id as string)
        }
      }
      const keepServices = [...serviceIds.values()]
      const oldServices = published.services.map((s) => s.id).filter((id) => !keepServices.includes(id))
      if (oldServices.length) {
        const r = await neon.from('services').delete().in('id', oldServices).eq('salon_id', salonId)
        if (r.error) return friendlyPublishError(r.error)
      }

      // 4) textos e opções da página; marcar como publicado liga o site público
      const st = await neon
        .from('site_settings')
        .upsert({
          salon_id: salonId,
          tagline: site.tagline,
          about: site.about,
          whatsapp: site.whatsapp,
          instagram: site.instagram,
          hours: site.hours,
          accent: site.accent,
          accent_color: site.accentColor || null,
          logo: site.logo || null,
          cover: site.cover || null,
          address: site.address.trim(),
          show_prices: site.showPrices,
          show_team: site.showTeam,
          deposit_percent: site.depositPercent,
          published: true,
          published_at: new Date().toISOString(),
        })
        .select('salon_id')
      if (st.error) {
        if (st.error.message.includes('published')) return 'O banco ainda não tem a migration de publicação do site (site_publish).'
        return friendlyPublishError(st.error)
      }

      const next: Studio = {
        site: { ...site, salonName: name },
        products: draft.products.map((p) => ({ ...p, id: productIds.get(p.id) ?? p.id })),
        services: draft.services.map((s) => ({
          ...s,
          id: serviceIds.get(s.id) ?? s.id,
          productId: s.productId ? (productIds.get(s.productId) ?? null) : null,
        })),
      }
      setDraft(next)
      setPublished(next)
      setIsLive(true)
      return null
    } finally {
      saving.current = false
    }
  }, [draft, live, published, salonId])

  const discard = useCallback(() => setDraft(published), [published])

  // avisa antes de sair com alterações não publicadas
  useEffect(() => {
    if (!dirty) return
    const onBefore = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [dirty])

  return { draft, setDraft, dirty, publish, discard, loading, error, isLive, publishedSlug: published.site.slug }
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { isNeonConfigured, neon } from '../lib/neon'

export { CATEGORIES, PALETTES } from '../lib/siteTheme'
export type { Category, FontId, PaletteId } from '../lib/siteTheme'
import { isCoverStyleId, paletteFor, type Category, type CoverStyleId, type FontId, type PaletteId } from '../lib/siteTheme'

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
  /** foto nova escolhida e ainda não publicada (data URL); vazio = nada de novo */
  photo: string
  /** foto já salva (id em site_photos); null = sem foto */
  photoId: string | null
}

/** produto que o negócio vende, mostrado na página pública (diferente de Product, que é gasto interno) */
export interface ShowcaseItem {
  id: string
  name: string
  description: string
  price: number
  visible: boolean
  photo: string
  photoId: string | null
}

/** plano por assinatura que o negócio vende (ex.: "Unhas o mês todo"); a cobrança é combinada pelo WhatsApp */
export interface ClientPlan {
  id: string
  name: string
  description: string
  /** preço por mês */
  price: number
  /** o que está incluso, um item por linha (até 8) */
  includes: string[]
  /** mostra a etiqueta "Novidade" na página */
  isNew: boolean
  visible: boolean
}

/** endereço de onde as fotos já salvas são servidas (a página pública usa o mesmo caminho) */
const PHOTO_BASE = 'https://app.ikizy.com'

/** o que mostrar como foto: a nova, se houver, senão a já salva */
export const photoUrl = (item: { photo: string; photoId: string | null }) =>
  item.photo || (item.photoId ? `${PHOTO_BASE}/api/photo?id=${item.photoId}` : '')

export interface SiteConfig {
  slug: string
  salonName: string
  tagline: string
  about: string
  whatsapp: string
  instagram: string
  hours: string
  /** paleta pronta (fundo, painéis e cor de destaque combinados) */
  palette: PaletteId
  /** fonte dos títulos */
  font: FontId
  /** estilo da capa sem foto (o que fica atrás do título) */
  coverStyle: CoverStyleId
  /** logo reduzido, como data URL; vazio = sem logo */
  logo: string
  /** foto de capa do topo do site, como data URL; vazio = sem foto */
  cover: string
  /** endereço do salão, com link para o mapa */
  address: string
  showPrices: boolean
  showTeam: boolean
  depositPercent: number
  /** a cliente pode pedir horário pela página do salão */
  onlineBooking: boolean
  /** antecedência mínima para pedir um horário, em horas */
  bookingNoticeHours: number
  /** até quantos dias à frente a cliente pode agendar */
  bookingWindowDays: number
}

export interface Studio {
  site: SiteConfig
  services: Service[]
  products: Product[]
  showcase: ShowcaseItem[]
  plans: ClientPlan[]
}

type StudioInput = Pick<Studio, 'site' | 'products'> & {
  services: (Omit<Service, 'photo' | 'photoId'> & Partial<Pick<Service, 'photo' | 'photoId'>>)[]
  showcase?: ShowcaseItem[]
  plans?: ClientPlan[]
}

const DEMO_STUDIO: StudioInput = {
  site: {
    slug: 'studio-maria-beauty',
    salonName: 'Studio Maria Beauty',
    tagline: 'Cuidado de verdade, do esmalte ao olhar.',
    about:
      'Um espaço pequeno, acolhedor e feito para você relaxar. Unhas, cílios, sobrancelhas e cabelo com atendimento no horário e produtos de qualidade.',
    whatsapp: '(11) 98765-0000',
    instagram: '@studiomariabeauty',
    hours: 'Seg a Sáb · 09h às 19h',
    palette: 'vermelho',
    font: 'moderna',
    coverStyle: 'sobrio',
    logo: '',
    cover: '',
    address: '',
    showPrices: true,
    showTeam: true,
    depositPercent: 20,
    onlineBooking: false,
    bookingNoticeHours: 2,
    bookingWindowDays: 30,
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

/** completa o que faltar (rascunhos antigos guardados no navegador não tinham foto nem vitrine) */
const normalize = (studio: StudioInput): Studio => ({
  ...studio,
  // rascunhos antigos (modo demonstração) não têm o estilo da capa
  site: { ...studio.site, coverStyle: isCoverStyleId(studio.site.coverStyle) ? studio.site.coverStyle : 'sobrio' },
  services: studio.services.map((sv) => ({ ...sv, photo: sv.photo ?? '', photoId: sv.photoId ?? null })),
  showcase: studio.showcase ?? [],
  plans: studio.plans ?? [],
})

export const DEFAULT_STUDIO: Studio = normalize(DEMO_STUDIO)

const STORAGE_KEY = 'ikizy:studio:v1'

function load(): Studio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalize({ ...DEFAULT_STUDIO, ...JSON.parse(raw) })
  } catch {
    /* sem storage: segue com o padrão */
  }
  return DEFAULT_STUDIO
}

/** rascunho não publicado guardado na aba: sobrevive a ir para Meu negócio (ou outra tela) e voltar */
const draftKey = (salonId: string | undefined) => `ikizy:studio:draft:${salonId ?? 'demo'}`

/** junta o rascunho guardado à versão recém-carregada; dos serviços e produtos de custo, só a escolha do site
 * (foto e "No site") vem do rascunho: nome, preço e duração valem como estão em Meu negócio */
function restoreDraft(salonId: string | undefined, fresh: Studio): Studio {
  try {
    const raw = sessionStorage.getItem(draftKey(salonId))
    if (!raw) return fresh
    const saved = normalize({ ...fresh, ...JSON.parse(raw) })
    const savedServices = new Map(saved.services.map((s) => [s.id, s]))
    return {
      ...saved,
      products: fresh.products,
      services: fresh.services.map((s) => {
        const prev = savedServices.get(s.id)
        return prev ? { ...s, visible: prev.visible, photo: prev.photo, photoId: prev.photoId } : s
      }),
    }
  } catch {
    return fresh
  }
}

export const newId = (prefix: string) =>
  `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/** site novo: sem textos de exemplo, só o nome e o endereço do negócio */
const blankStudio = (name: string, slug: string): Studio => ({
  site: { ...DEFAULT_STUDIO.site, slug, salonName: name, tagline: '', about: '', whatsapp: '', instagram: '', hours: '', logo: '', cover: '', address: '' },
  services: [],
  products: [],
  showcase: [],
  plans: [],
})

interface SettingsRow {
  tagline: string
  about: string
  whatsapp: string
  instagram: string
  hours: string
  accent?: string
  accent_color?: string | null
  theme?: string
  palette?: PaletteId
  font?: FontId
  cover_style?: string
  logo?: string | null
  cover?: string | null
  address?: string
  show_prices: boolean
  show_team: boolean
  deposit_percent: number
  online_booking?: boolean
  booking_notice_hours?: number
  booking_window_days?: number
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
  const [draft, setDraft] = useState<Studio>(() => (live ? published : restoreDraft(salonId, published)))
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)
  /** true depois do primeiro "Publicar": só então a página pública existe */
  const [isLive, setIsLive] = useState(!live)
  const saving = useRef(false)

  useEffect(() => {
    if (!live || !neon || !salonId) return
    let cancelled = false
    void (async () => {
      const [settings, svcs, prods, salonRow, shop, plans] = await Promise.all([
        neon.from('site_settings').select('*').eq('salon_id', salonId).maybeSingle(),
        neon
          .from('services')
          .select('id, name, category, price, duration, monthly_volume, product_id, visible, photo_id')
          .eq('salon_id', salonId)
          .order('created_at'),
        neon.from('products').select('id, name, monthly_spend').eq('salon_id', salonId).order('created_at'),
        neon.from('salons').select('name, slug').eq('id', salonId).maybeSingle(),
        neon
          .from('showcase_items')
          .select('id, name, description, price, photo_id, visible')
          .eq('salon_id', salonId)
          .order('position')
          .order('created_at'),
        neon
          .from('client_plans')
          .select('id, name, description, price, includes, is_new, visible')
          .eq('salon_id', salonId)
          .order('position')
          .order('created_at'),
      ])
      if (cancelled) return
      // a vitrine pode não existir ainda neste ambiente (migration pendente): o resto do editor continua funcionando
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
              palette: paletteFor(row).id,
              font: row.font ?? 'moderna',
              coverStyle: isCoverStyleId(row.cover_style) ? row.cover_style : 'sobrio',
              logo: row.logo ?? '',
              cover: row.cover ?? '',
              address: row.address ?? '',
              showPrices: row.show_prices,
              showTeam: row.show_team,
              depositPercent: row.deposit_percent,
              onlineBooking: row.online_booking ?? false,
              bookingNoticeHours: row.booking_notice_hours ?? 2,
              bookingWindowDays: row.booking_window_days ?? 30,
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
          photo: '',
          photoId: (s.photo_id as string | null) ?? null,
        })),
        showcase: shop.error
          ? []
          : (shop.data ?? []).map((x) => ({
              id: x.id as string,
              name: x.name as string,
              description: (x.description as string) ?? '',
              price: Number(x.price),
              visible: x.visible as boolean,
              photo: '',
              photoId: (x.photo_id as string | null) ?? null,
            })),
        plans: plans.error
          ? []
          : (plans.data ?? []).map((x) => ({
              id: x.id as string,
              name: x.name as string,
              description: (x.description as string) ?? '',
              price: Number(x.price),
              includes: (x.includes as string[] | null) ?? [],
              isNew: Boolean(x.is_new),
              visible: x.visible as boolean,
            })),
      }
      setPublished(studio)
      setDraft(restoreDraft(salonId, studio))
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

      // 3) fotos novas: sobem primeiro, para os serviços e a vitrine apontarem para elas
      const photoOf = new Map<string, string | null>()
      for (const item of [...draft.services, ...draft.showcase]) {
        if (item.photo) {
          const r = await neon.from('site_photos').insert({ salon_id: salonId, data: item.photo }).select('id').single()
          if (r.error || !r.data) return 'Não foi possível salvar uma das fotos. Tente com uma imagem menor.'
          photoOf.set(item.id, r.data.id as string)
        } else {
          photoOf.set(item.id, item.photoId)
        }
      }

      // 4) serviços
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
          photo_id: photoOf.get(s.id) ?? null,
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

      // 5) vitrine de produtos à venda
      const showcaseIds = new Map<string, string>()
      let position = 0
      for (const x of draft.showcase) {
        const fields = {
          name: x.name.trim() || 'Produto',
          description: x.description.trim().slice(0, 120),
          price: x.price,
          visible: x.visible,
          photo_id: photoOf.get(x.id) ?? null,
          position: position++,
        }
        if (isUuid(x.id)) {
          const r = await neon.from('showcase_items').update(fields).eq('id', x.id).eq('salon_id', salonId)
          if (r.error) return friendlyPublishError(r.error)
          showcaseIds.set(x.id, x.id)
        } else {
          const r = await neon.from('showcase_items').insert({ ...fields, salon_id: salonId }).select('id').single()
          if (r.error || !r.data) return friendlyPublishError(r.error ?? { message: '' })
          showcaseIds.set(x.id, r.data.id as string)
        }
      }
      const keepShowcase = [...showcaseIds.values()]
      const oldShowcase = published.showcase.map((x) => x.id).filter((id) => !keepShowcase.includes(id))
      if (oldShowcase.length) {
        const r = await neon.from('showcase_items').delete().in('id', oldShowcase).eq('salon_id', salonId)
        if (r.error) return friendlyPublishError(r.error)
      }

      // planos por assinatura
      const planIds = new Map<string, string>()
      let planPos = 0
      for (const pl of draft.plans) {
        const fields = {
          name: pl.name.trim() || 'Plano',
          description: pl.description.trim().slice(0, 200),
          price: pl.price,
          includes: pl.includes.map((i) => i.trim()).filter(Boolean).slice(0, 8),
          is_new: pl.isNew,
          visible: pl.visible,
          position: planPos++,
        }
        if (isUuid(pl.id)) {
          const r = await neon.from('client_plans').update(fields).eq('id', pl.id).eq('salon_id', salonId)
          if (r.error) return friendlyPublishError(r.error)
          planIds.set(pl.id, pl.id)
        } else {
          const r = await neon.from('client_plans').insert({ ...fields, salon_id: salonId }).select('id').single()
          if (r.error || !r.data) return friendlyPublishError(r.error ?? { message: '' })
          planIds.set(pl.id, r.data.id as string)
        }
      }
      const keepPlans = [...planIds.values()]
      const oldPlans = published.plans.map((x) => x.id).filter((id) => !keepPlans.includes(id))
      if (oldPlans.length) {
        const r = await neon.from('client_plans').delete().in('id', oldPlans).eq('salon_id', salonId)
        if (r.error) return friendlyPublishError(r.error)
      }

      // fotos que ninguém usa mais (trocadas ou removidas) saem do banco
      const keepPhotos = [...photoOf.values()].filter((id): id is string => Boolean(id))
      const clean = neon.from('site_photos').delete().eq('salon_id', salonId)
      const cleaned = keepPhotos.length ? await clean.not('id', 'in', `(${keepPhotos.join(',')})`) : await clean
      if (cleaned.error) console.error('limpeza de fotos', cleaned.error)

      // 6) textos e opções da página; marcar como publicado liga o site público
      const st = await neon
        .from('site_settings')
        .upsert({
          salon_id: salonId,
          tagline: site.tagline,
          about: site.about,
          whatsapp: site.whatsapp,
          instagram: site.instagram,
          hours: site.hours,
          palette: site.palette,
          accent_color: null,
          font: site.font,
          cover_style: site.coverStyle,
          logo: site.logo || null,
          cover: site.cover || null,
          address: site.address.trim(),
          show_prices: site.showPrices,
          show_team: site.showTeam,
          deposit_percent: site.depositPercent,
          online_booking: site.onlineBooking,
          booking_notice_hours: Math.min(168, Math.max(0, Math.round(site.bookingNoticeHours))),
          booking_window_days: Math.min(90, Math.max(1, Math.round(site.bookingWindowDays))),
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
          photo: '',
          photoId: photoOf.get(s.id) ?? null,
        })),
        showcase: draft.showcase.map((x) => ({
          ...x,
          id: showcaseIds.get(x.id) ?? x.id,
          photo: '',
          photoId: photoOf.get(x.id) ?? null,
        })),
        plans: draft.plans.map((pl) => ({
          ...pl,
          id: planIds.get(pl.id) ?? pl.id,
          includes: pl.includes.map((i) => i.trim()).filter(Boolean).slice(0, 8),
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

  // guarda o rascunho enquanto houver alteração não publicada (só depois de carregar, para não apagar o guardado)
  useEffect(() => {
    if (loading) return
    try {
      if (dirty) sessionStorage.setItem(draftKey(salonId), JSON.stringify(draft))
      else sessionStorage.removeItem(draftKey(salonId))
    } catch {
      /* sem espaço (fotos grandes) ou sem storage: segue só na memória */
    }
  }, [draft, dirty, loading, salonId])

  // avisa antes de sair com alterações não publicadas
  useEffect(() => {
    if (!dirty) return
    const onBefore = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [dirty])

  return { draft, setDraft, dirty, publish, discard, loading, error, isLive, publishedSlug: published.site.slug }
}

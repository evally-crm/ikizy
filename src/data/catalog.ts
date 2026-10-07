import { useCallback, useEffect, useMemo, useState } from 'react'

export type AccentId = 'bordo' | 'rubi' | 'vinho'

export const ACCENTS: Record<AccentId, { label: string; color: string; soft: string }> = {
  bordo: { label: 'Bordô', color: '#460106', soft: '#f3dfe1' },
  rubi: { label: 'Rubi', color: '#bf0c22', soft: '#fbe0e4' },
  vinho: { label: 'Vinho', color: '#800513', soft: '#f6dde0' },
}

export const CATEGORIES = ['Unhas', 'Cílios', 'Sobrancelha', 'Cabelo', 'Estética'] as const
export type Category = (typeof CATEGORIES)[number]

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

/** rascunho editável + versão publicada (persistida) */
export function useStudio() {
  const [published, setPublished] = useState<Studio>(load)
  const [draft, setDraft] = useState<Studio>(published)

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(published), [draft, published])

  const publish = useCallback(() => {
    setPublished(draft)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch {
      /* ignora */
    }
  }, [draft])

  const discard = useCallback(() => setDraft(published), [published])

  // avisa antes de sair com alterações não publicadas
  useEffect(() => {
    if (!dirty) return
    const onBefore = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [dirty])

  return { draft, setDraft, dirty, publish, discard }
}

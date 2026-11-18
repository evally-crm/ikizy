import { serviceMargin, type MarginProduct, type MarginService } from './margin'

export interface CatalogService extends MarginService {
  id: string
  name: string
  category: string
}

export interface CatalogProduct extends MarginProduct {
  name: string
}

export interface BusinessSummary {
  serviceCount: number
  /** serviços ainda sem preço */
  unpriced: number
  /** serviços com preço e sem material: a sobra deles não é calculada */
  withoutMaterial: number
  /** sobra média em % dos serviços com preço e material (null se nenhum tem) */
  averageMarginPct: number | null
  /** gasto mensal total com materiais */
  materialSpend: number
}

/** o resumo de Meu negócio: a linha de cada aba e os avisos */
export function summarizeBusiness(services: CatalogService[], products: CatalogProduct[]): BusinessSummary {
  const withMaterial = services.filter((s) => s.price > 0 && s.productId)
  const margins = withMaterial.map((s) => serviceMargin(s, services, products).marginPct)
  return {
    serviceCount: services.length,
    unpriced: services.filter((s) => s.price <= 0).length,
    withoutMaterial: services.filter((s) => serviceNeeds(s).includes('sem-material')).length,
    averageMarginPct: margins.length ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length) : null,
    materialSpend: products.reduce((sum, p) => sum + p.monthlySpend, 0),
  }
}

/** o que ainda falta num serviço: vira selo no cartão e opção do filtro */
export type ServiceNeed = 'sem-preco' | 'sem-material'

export function serviceNeeds(s: CatalogService): ServiceNeed[] {
  if (s.price <= 0) return ['sem-preco']
  return s.productId ? [] : ['sem-material']
}

/** busca por nome ou categoria (sem acento nem caixa) e filtro de categoria; `category` vazio = todas */
export function filterServices<T extends CatalogService>(services: T[], query: string, category: string): T[] {
  const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const q = fold(query.trim())
  return services.filter((s) => (!category || s.category === category) && (!q || fold(s.name).includes(q) || fold(s.category).includes(q)))
}

/** quantos serviços usam cada material */
export function usageByProduct(services: CatalogService[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of services) if (s.productId) out[s.productId] = (out[s.productId] ?? 0) + 1
  return out
}

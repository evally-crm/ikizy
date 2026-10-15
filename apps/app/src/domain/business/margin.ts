export interface MarginService {
  price: number
  productId: string | null
  /** atendimentos feitos por mês, em média */
  monthlyVolume: number
}

export interface MarginProduct {
  id: string
  /** gasto médio por mês com o material, em reais */
  monthlySpend: number
}

export interface ServiceMargin {
  /** custo de material por atendimento */
  cost: number
  /** o que sobra de cada atendimento */
  margin: number
  /** sobra em % do preço (0 quando o serviço não tem preço) */
  marginPct: number
}

/** o gasto mensal do material é dividido entre todos os atendimentos que o usam */
export function serviceMargin(service: MarginService, services: MarginService[], products: MarginProduct[]): ServiceMargin {
  const product = products.find((p) => p.id === service.productId)
  let cost = 0
  if (product) {
    const volume = services.filter((s) => s.productId === product.id).reduce((sum, s) => sum + s.monthlyVolume, 0)
    cost = volume > 0 ? product.monthlySpend / volume : 0
  }
  const margin = service.price - cost
  return { cost, margin, marginPct: service.price > 0 ? Math.round((margin / service.price) * 100) : 0 }
}

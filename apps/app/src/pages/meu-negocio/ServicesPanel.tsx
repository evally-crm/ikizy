import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { CATEGORIES, type Product, type Service } from '../../data/catalog'
import { filterServices, serviceMargin, serviceNeeds, type BusinessSummary, type ServiceNeed } from '../../domain/business'
import { formatDuration } from '../../lib/agendaTime'
import { formatBRL } from '../../lib/format'
import { Select } from '../../components/controls'
import { Button, ItemCard, ItemCards, Panel, SearchField } from '../../components/ui'

const short = (v: number) => formatBRL(v).replace(',00', '')

const NEED_LABEL: Record<ServiceNeed, string> = { 'sem-preco': 'Sem preço', 'sem-material': 'Sem material' }

/**
 * serviços em cartões: duração à esquerda, selos do que falta (ou a sobra) e o preço à direita.
 * O filtro em pílula junta categorias e o que falta; clicar num cartão abre o serviço.
 */
export function ServicesPanel({
  services,
  products,
  summary,
  canManage,
  onNew,
  onOpen,
}: {
  services: Service[]
  products: Product[]
  /** a linha de resumo e os avisos (vem do domínio) */
  summary: BusinessSummary
  canManage: boolean
  onNew: () => void
  onOpen: (service: Service) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const need = filter === 'sem-preco' || filter === 'sem-material' ? filter : null
  const rows = useMemo(
    () => filterServices(services, query, need ? '' : filter).filter((s) => !need || serviceNeeds(s).includes(need)),
    [services, query, filter, need],
  )
  const usedCategories = CATEGORIES.filter((c) => services.some((s) => s.category === c))
  const options = [
    { value: '', label: 'Todos' },
    ...(summary.unpriced > 0 ? [{ value: 'sem-preco', label: 'Sem preço', hint: String(summary.unpriced) }] : []),
    ...(summary.withoutMaterial > 0 ? [{ value: 'sem-material', label: 'Sem material', hint: String(summary.withoutMaterial) }] : []),
    ...(usedCategories.length > 1 ? usedCategories.map((c) => ({ value: c, label: c })) : []),
  ]

  return (
    <Panel
      title={
        <>
          Serviços<span className="panel__count">{summary.serviceCount}</span>
        </>
      }
      action={
        <span className="panel__tools">
          {options.length > 1 && <Select pill label="Filtrar serviços" value={filter} options={options} onChange={setFilter} />}
          {canManage && (
            <Button size="sm" onClick={onNew}>
              <Plus size={16} aria-hidden="true" /> Novo
            </Button>
          )}
        </span>
      }
    >
      {summary.averageMarginPct !== null && <p className="panel__note">Em média sobram {summary.averageMarginPct}% do preço depois do material.</p>}
      {services.length > 6 && <SearchField value={query} onChange={setQuery} label="Buscar serviço" placeholder="Buscar serviço" />}
      <ItemCards label="Serviços do negócio" empty={services.length === 0 ? 'Nenhum serviço ainda.' : 'Nenhum serviço com esse filtro.'}>
        {rows.map((s) => {
          const needs = serviceNeeds(s)
          const margin = needs.length === 0 ? serviceMargin(s, services, products).marginPct : null
          return (
            <ItemCard
              key={s.id}
              lead={formatDuration(s.duration)}
              leadLabel={s.category}
              title={s.name}
              meta={
                <>
                  {needs.map((n) => (
                    <span key={n} className="badge badge--soft badge--warning">
                      {NEED_LABEL[n]}
                    </span>
                  ))}
                  {margin !== null && <span className="badge badge--soft badge--success">Sobra {margin}%</span>}
                </>
              }
              trail={s.price > 0 ? short(s.price) : '–'}
              onOpen={canManage ? () => onOpen(s) : undefined}
            />
          )
        })}
      </ItemCards>
      <p className="panel__note">Foto e o que aparece no site ficam no Meu site.</p>
    </Panel>
  )
}

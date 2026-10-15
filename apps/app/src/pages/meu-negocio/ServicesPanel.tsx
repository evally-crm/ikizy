import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { CATEGORIES, type Product, type Service } from '../../data/catalog'
import { filterServices, serviceMargin } from '../../domain/business'
import { formatDuration } from '../../lib/agendaTime'
import { formatBRL } from '../../lib/format'
import { Select } from '../../components/controls'
import { Button, DataTable, Panel, SearchField, type Column } from '../../components/ui'

const short = (v: number) => formatBRL(v).replace(',00', '')

/** serviços em tabela, com busca e filtro de categoria; clicar numa linha abre o serviço */
export function ServicesPanel({
  services,
  products,
  canManage,
  onNew,
  onOpen,
}: {
  services: Service[]
  products: Product[]
  canManage: boolean
  onNew: () => void
  onOpen: (service: Service) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const rows = useMemo(() => filterServices(services, query, category), [services, query, category])
  const usedCategories = CATEGORIES.filter((c) => services.some((s) => s.category === c))

  const columns: Column<Service>[] = [
    { key: 'name', label: 'Serviço', render: (s) => <strong>{s.name}</strong> },
    { key: 'category', label: 'Categoria', hideOnMobile: true, render: (s) => s.category },
    { key: 'duration', label: 'Duração', hideOnMobile: true, render: (s) => formatDuration(s.duration) },
    {
      key: 'margin',
      label: 'Sobra',
      align: 'right',
      hideOnMobile: true,
      render: (s) => {
        if (!s.productId || s.price <= 0) return '–'
        const m = serviceMargin(s, services, products)
        return `${short(m.margin)} (${m.marginPct}%)`
      },
    },
    {
      key: 'price',
      label: 'Preço',
      align: 'right',
      render: (s) => (s.price > 0 ? <strong>{short(s.price)}</strong> : <span className="badge badge--pendente">Sem preço</span>),
    },
  ]

  return (
    <Panel
      title="Serviços"
      eyebrow="Foto e o que aparece no site ficam no Meu site"
      action={
        canManage ? (
          <Button size="sm" onClick={onNew}>
            <Plus size={16} aria-hidden="true" /> Novo serviço
          </Button>
        ) : null
      }
    >
      <div className="bizfilters">
        <SearchField value={query} onChange={setQuery} label="Buscar serviço" placeholder="Buscar serviço" />
        {usedCategories.length > 1 && (
          <Select
            label="Categoria"
            hideLabel
            value={category}
            options={[{ value: '', label: 'Todas as categorias' }, ...usedCategories.map((c) => ({ value: c, label: c }))]}
            onChange={setCategory}
          />
        )}
      </div>
      <DataTable
        caption="Serviços do negócio"
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        onRowClick={canManage ? onOpen : undefined}
        empty={services.length === 0 ? 'Nenhum serviço ainda.' : 'Nenhum serviço encontrado com esse filtro.'}
      />
    </Panel>
  )
}

import { Plus } from 'lucide-react'
import type { Product, Service } from '../../data/catalog'
import { usageByProduct } from '../../domain/business'
import { formatBRL } from '../../lib/format'
import { Button, DataTable, Panel, type Column } from '../../components/ui'

/** materiais em tabela: nome, em quantos serviços entra e o gasto por mês */
export function MaterialsPanel({
  products,
  services,
  total,
  canManage,
  onNew,
  onOpen,
}: {
  products: Product[]
  services: Service[]
  /** gasto mensal somado (vem do resumo do domínio) */
  total: number
  canManage: boolean
  onNew: () => void
  onOpen: (product: Product) => void
}) {
  const usage = usageByProduct(services)
  const columns: Column<Product>[] = [
    { key: 'name', label: 'Material', render: (p) => <strong>{p.name}</strong> },
    { key: 'usage', label: 'Usado em', hideOnMobile: true, render: (p) => `${usage[p.id] ?? 0} serviço(s)` },
    { key: 'spend', label: 'Gasto por mês', align: 'right', render: (p) => <strong>{formatBRL(p.monthlySpend).replace(',00', '')}</strong> },
  ]
  return (
    <Panel
      title="Custos de material"
      eyebrow={`Só para você: entram no lucro do Financeiro e na sobra de cada serviço${total > 0 ? ` · total ${formatBRL(total).replace(',00', '')} por mês` : ''}`}
      action={
        canManage ? (
          <Button size="sm" onClick={onNew}>
            <Plus size={16} aria-hidden="true" /> Novo material
          </Button>
        ) : null
      }
    >
      <DataTable
        caption="Materiais do negócio"
        columns={columns}
        rows={products}
        rowKey={(p) => p.id}
        onRowClick={canManage ? onOpen : undefined}
        empty="Nenhum material cadastrado."
      />
    </Panel>
  )
}

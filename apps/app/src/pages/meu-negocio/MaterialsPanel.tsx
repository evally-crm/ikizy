import { Plus } from 'lucide-react'
import type { Product, Service } from '../../data/catalog'
import { formatBRL } from '../../lib/format'
import { Button, ItemCard, ItemCards, Panel } from '../../components/ui'

const short = (v: number) => formatBRL(v).replace(',00', '')

/** materiais em cartões: em quantos serviços entra (à esquerda), em quais, e o gasto por mês */
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
  return (
    <Panel
      title={
        <>
          Materiais<span className="panel__count">{products.length}</span>
        </>
      }
      action={
        canManage ? (
          <Button size="sm" onClick={onNew}>
            <Plus size={16} aria-hidden="true" /> Novo
          </Button>
        ) : null
      }
    >
      {total > 0 && <p className="panel__note">{short(total)} por mês no total. Só você vê: entra no lucro do Financeiro e na sobra de cada serviço.</p>}
      <ItemCards label="Materiais do negócio" empty="Nenhum material cadastrado.">
        {products.map((p) => {
          const usedIn = services.filter((s) => s.productId === p.id)
          return (
            <ItemCard
              key={p.id}
              lead={usedIn.length}
              leadLabel={usedIn.length === 1 ? 'serviço' : 'serviços'}
              title={p.name}
              meta={
                usedIn.length === 0 ? (
                  <span className="badge badge--soft badge--warning">Nenhum serviço usa</span>
                ) : (
                  <span className="itemcard__info">{usedIn.map((s) => s.name).join(', ')}</span>
                )
              }
              trail={
                <>
                  {short(p.monthlySpend)}
                  <small>por mês</small>
                </>
              }
              onOpen={canManage ? () => onOpen(p) : undefined}
            />
          )
        })}
      </ItemCards>
    </Panel>
  )
}

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ClientPlan, ShowcaseItem } from '../../data/catalog'
import { SITE_LIMITS, splitIncludes } from '../../domain/site'
import { Switch } from '../../components/controls'
import { Button, Collapse, MoneyInput } from '../../components/ui'
import { ShowcaseEditor } from './ShowcaseEditor'
import './MeuSite.css'

/** uma linha de plano por assinatura, editável */
function PlanRow({ plan, onPatch, onRemove }: { plan: ClientPlan; onPatch: (patch: Partial<ClientPlan>) => void; onRemove: () => void }) {
  return (
    <li className={`row ${plan.visible ? '' : 'is-hidden'}`.trim()}>
      <div className="row__top">
        <span className="input row__name">
          <input aria-label="Nome do plano" placeholder="Nome do plano" value={plan.name} maxLength={60} onChange={(e) => onPatch({ name: e.target.value })} />
        </span>
        <Switch checked={plan.visible} onChange={(v) => onPatch({ visible: v })} label="No site" />
        <button type="button" className="chevbtn" aria-label={`Remover ${plan.name || 'plano'}`} onClick={onRemove}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="row__grid">
        <label className="mini-field">
          <span>Preço por mês</span>
          <MoneyInput label="Preço por mês" value={plan.price} onChange={(v) => onPatch({ price: v })} />
        </label>
        <label className="mini-field mini-field--wide">
          <span>Descrição curta</span>
          <span className="input">
            <input value={plan.description} maxLength={200} placeholder="Ex.: manutenção sem pagar a cada visita" onChange={(e) => onPatch({ description: e.target.value })} />
          </span>
        </label>
        <label className="mini-field mini-field--wide">
          <span>O que inclui (um por linha, até {SITE_LIMITS.planIncludes})</span>
          <span className="input input--area">
            <textarea
              rows={3}
              value={plan.includes.join('\n')}
              placeholder={'2 manutenções por mês\nPrioridade na agenda'}
              onChange={(e) => onPatch({ includes: splitIncludes(e.target.value) })}
            />
          </span>
        </label>
      </div>
      <Switch checked={plan.isNew} onChange={(v) => onPatch({ isNew: v })} label="Etiqueta “Novidade” no site" />
    </li>
  )
}

/** parte "Extras": o que vai além dos serviços, planos por assinatura e produtos à venda (cada um recolhido até ter itens) */
export function ExtrasEditor({
  plans,
  showcase,
  onPatchPlan,
  onAddPlan,
  onRemovePlan,
  onPatchShowcase,
  onAddShowcase,
  onRemoveShowcase,
}: {
  plans: ClientPlan[]
  showcase: ShowcaseItem[]
  onPatchPlan: (id: string, patch: Partial<ClientPlan>) => void
  onAddPlan: () => void
  onRemovePlan: (id: string) => void
  onPatchShowcase: (id: string, patch: Partial<ShowcaseItem>) => void
  onAddShowcase: () => void
  onRemoveShowcase: (id: string) => void
}) {
  const [open, setOpen] = useState(() => ({ plans: plans.length > 0, showcase: showcase.length > 0 }))
  return (
    <div className="catalog">
      <p className="catalog__intro">Opcional. Só aparece no site o que você ligar aqui.</p>
      <Collapse
        title="Planos por assinatura"
        meta={plans.length ? `${plans.length} ${plans.length === 1 ? 'plano' : 'planos'}` : 'Pacotes que a cliente paga por mês'}
        open={open.plans}
        onToggle={() => setOpen((o) => ({ ...o, plans: !o.plans }))}
      >
        <p className="catalog__intro">
          Ex.: “Unhas o mês todo”. Aparece com o botão “Quero este plano”, que abre o WhatsApp. A cobrança você combina com a cliente.
        </p>
        <ul className="rows">
          {plans.map((pl) => (
            <PlanRow key={pl.id} plan={pl} onPatch={(patch) => onPatchPlan(pl.id, patch)} onRemove={() => onRemovePlan(pl.id)} />
          ))}
        </ul>
        <Button variant="ghost" onClick={onAddPlan} disabled={plans.length >= SITE_LIMITS.plans} className="catalog__add">
          <Plus size={16} aria-hidden="true" /> Novo plano
        </Button>
      </Collapse>
      <Collapse
        title="Produtos à venda"
        meta={showcase.length ? `${showcase.length} ${showcase.length === 1 ? 'produto' : 'produtos'}` : 'Óleos, cremes, kits'}
        open={open.showcase}
        onToggle={() => setOpen((o) => ({ ...o, showcase: !o.showcase }))}
      >
        <ShowcaseEditor items={showcase} onPatch={onPatchShowcase} onAdd={onAddShowcase} onRemove={onRemoveShowcase} />
      </Collapse>
    </div>
  )
}

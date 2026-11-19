import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ClientPlan, PlanKind, ShowcaseItem } from '../../data/catalog'
import { SITE_LIMITS, splitIncludes } from '../../domain/site'
import { Select, Switch } from '../../components/controls'
import { Button, Collapse, MoneyInput } from '../../components/ui'
import { ReviewsEditor } from './ReviewsEditor'
import { ShowcaseEditor } from './ShowcaseEditor'
import './MeuSite.css'

const KINDS = [
  { value: 'assinatura', label: 'Plano por assinatura' },
  { value: 'pacote', label: 'Pacote' },
  { value: 'promocao', label: 'Promoção' },
]

/** uma linha de plano, pacote ou promoção, editável */
function PlanRow({ plan, onPatch, onRemove }: { plan: ClientPlan; onPatch: (patch: Partial<ClientPlan>) => void; onRemove: () => void }) {
  return (
    <li className={`row ${plan.visible ? '' : 'is-hidden'}`.trim()}>
      <div className="row__top">
        <span className="input row__name">
          <input aria-label="Nome do plano" placeholder="Nome do plano" value={plan.name} maxLength={60} onChange={(e) => onPatch({ name: e.target.value })} />
        </span>
        <Switch checked={plan.visible} onChange={(v) => onPatch({ visible: v })} label="No site" />
        <button type="button" className="chevbtn" aria-label={`Remover ${plan.name || 'item'}`} onClick={onRemove}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="row__grid">
        <div className="mini-field mini-field--wide">
          <Select label="Tipo" value={plan.kind} options={KINDS} onChange={(v) => onPatch({ kind: v as PlanKind })} />
        </div>
        <label className="mini-field">
          <span>{plan.kind === 'assinatura' ? 'Preço por mês' : plan.kind === 'pacote' ? 'Preço do pacote' : 'Preço da promoção'}</span>
          <MoneyInput label="Preço" value={plan.price} onChange={(v) => onPatch({ price: v })} />
        </label>
        {plan.kind !== 'assinatura' && (
          <>
            <label className="mini-field">
              <span>De (preço riscado, opcional)</span>
              <MoneyInput label="Preço de" value={plan.oldPrice ?? 0} onChange={(v) => onPatch({ oldPrice: v > 0 ? v : null })} />
            </label>
            <label className="mini-field mini-field--wide">
              <span>Vale até (opcional, depois dessa data sai do site)</span>
              <span className="input">
                <input type="date" value={plan.validUntil ?? ''} onChange={(e) => onPatch({ validUntil: e.target.value || null })} />
              </span>
            </label>
          </>
        )}
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
  const [open, setOpen] = useState(() => ({ plans: plans.length > 0, showcase: showcase.length > 0, reviews: false }))
  return (
    <div className="catalog">
      <p className="catalog__intro">Opcional. Só aparece no site o que você ligar aqui.</p>
      <Collapse
        title="Planos, pacotes e promoções"
        meta={plans.length ? `${plans.length} ${plans.length === 1 ? 'item' : 'itens'}` : 'Assinatura mensal, pacote ou oferta por tempo limitado'}
        open={open.plans}
        onToggle={() => setOpen((o) => ({ ...o, plans: !o.plans }))}
      >
        <p className="catalog__intro">
          Ex.: “Unhas o mês todo” (assinatura), “4 esmaltações” (pacote) ou “Dia das Mães” (promoção, com preço de e validade). Cada um aparece com um botão que abre o WhatsApp. A cobrança você combina com a cliente.
        </p>
        <ul className="rows">
          {plans.map((pl) => (
            <PlanRow key={pl.id} plan={pl} onPatch={(patch) => onPatchPlan(pl.id, patch)} onRemove={() => onRemovePlan(pl.id)} />
          ))}
        </ul>
        <Button variant="ghost" onClick={onAddPlan} disabled={plans.length >= SITE_LIMITS.plans} className="catalog__add">
          <Plus size={16} aria-hidden="true" /> Novo item
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
      <Collapse
        title="Avaliações"
        meta="O que as clientes escreveram"
        open={open.reviews}
        onToggle={() => setOpen((o) => ({ ...o, reviews: !o.reviews }))}
      >
        <ReviewsEditor />
      </Collapse>
    </div>
  )
}

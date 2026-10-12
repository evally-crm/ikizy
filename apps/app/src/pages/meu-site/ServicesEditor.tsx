import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { CATEGORIES, photoUrl, type ClientPlan, type Service } from '../../data/catalog'
import { SITE_LIMITS, splitIncludes } from '../../domain/site'
import { formatDuration } from '../../lib/agendaTime'
import { formatBRL } from '../../lib/format'
import { dash } from '../../lib/routes'
import PhotoPick from '../../components/PhotoPick'
import { Switch } from '../../components/controls'
import { Button, Collapse, MoneyInput } from '../../components/ui'
import './MeuSite.css'

const PLANS_GROUP = 'planos'

/** uma linha de serviço: foto, nome, duração e preço (só leitura aqui) e o botão "No site" */
function ServiceRow({ service, onPatch }: { service: Service; onPatch: (patch: Partial<Service>) => void }) {
  return (
    <li className={`row ${service.visible ? '' : 'is-hidden'}`.trim()}>
      <div className="row__top">
        <PhotoPick
          src={photoUrl(service)}
          label={service.name || 'serviço'}
          onPick={(photo) => onPatch({ photo })}
          onClear={() => onPatch({ photo: '', photoId: null })}
        />
        <span className="row__label">
          <strong>{service.name}</strong>
          <small>
            {formatDuration(service.duration)} · {service.price > 0 ? formatBRL(service.price) : 'sem preço (não aparece no agendamento online)'}
          </small>
        </span>
        <Switch checked={service.visible} onChange={(v) => onPatch({ visible: v })} label="No site" />
      </div>
    </li>
  )
}

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

/** etapa "Serviços e planos": quais serviços aparecem (por categoria) e os planos por assinatura */
export function ServicesEditor({
  services,
  plans,
  onPatchService,
  onPatchPlan,
  onAddPlan,
  onRemovePlan,
}: {
  services: Service[]
  plans: ClientPlan[]
  onPatchService: (id: string, patch: Partial<Service>) => void
  onPatchPlan: (id: string, patch: Partial<ClientPlan>) => void
  onAddPlan: () => void
  onRemovePlan: (id: string) => void
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (key: string) =>
    setOpen((g) => {
      const next = new Set(g)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="catalog">
      <p className="catalog__intro">
        Aqui você escolhe a foto e quais serviços aparecem no site. Nome, preço e duração ficam em <Link to={dash('/negocio#servicos')}>Meu negócio</Link>,
        valendo para a agenda e para o site.
      </p>
      {CATEGORIES.filter((cat) => services.some((x) => x.category === cat)).map((cat) => {
        const list = services.filter((x) => x.category === cat)
        return (
          <Collapse key={cat} title={cat} meta={`${list.length} ${list.length === 1 ? 'serviço' : 'serviços'}`} open={open.has(cat)} onToggle={() => toggle(cat)}>
            <ul className="rows">
              {list.map((s) => (
                <ServiceRow key={s.id} service={s} onPatch={(patch) => onPatchService(s.id, patch)} />
              ))}
            </ul>
          </Collapse>
        )
      })}
      {services.length === 0 && (
        <p className="catalog__empty">
          Nenhum serviço ainda. Cadastre em <Link to={dash('/negocio#servicos')}>Meu negócio</Link>.
        </p>
      )}
      <Link to={dash('/negocio#servicos')} className="btn btn--ghost catalog__add">
        <Plus size={16} aria-hidden="true" /> Cadastrar ou editar serviços
      </Link>

      <Collapse
        title="Planos por assinatura"
        badge="Novidade"
        meta={plans.length ? `${plans.length} ${plans.length === 1 ? 'plano' : 'planos'}` : 'Pacotes que a cliente paga por mês'}
        open={open.has(PLANS_GROUP)}
        onToggle={() => toggle(PLANS_GROUP)}
      >
        <p className="catalog__intro">
          Ex.: “Unhas o mês todo”. Aparece na sua página com o botão “Quero este plano”, que abre o WhatsApp. A cobrança você combina com a cliente.
        </p>
        <ul className="rows">
          {plans.map((pl) => (
            <PlanRow key={pl.id} plan={pl} onPatch={(patch) => onPatchPlan(pl.id, patch)} onRemove={() => onRemovePlan(pl.id)} />
          ))}
        </ul>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen((g) => new Set(g).add(PLANS_GROUP))
            onAddPlan()
          }}
          disabled={plans.length >= SITE_LIMITS.plans}
          className="catalog__add"
        >
          <Plus size={16} aria-hidden="true" /> Novo plano
        </Button>
      </Collapse>
    </div>
  )
}

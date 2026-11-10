import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { CATEGORIES, photoUrl, type Product, type Service } from '../../data/catalog'
import type { ServiceInput } from '../../data/business'
import { businessAreas, missingSuggestions, parseAmount } from '../../domain/site'
import { SEGMENTS, type Segment, type SuggestedService } from '../../lib/segments'
import { formatDuration } from '../../lib/agendaTime'
import PhotoPick from '../../components/PhotoPick'
import { Switch } from '../../components/controls'
import { ConfirmDialog } from '../../components/Modal'
import { Button, Collapse } from '../../components/ui'
import { ServiceDialog } from '../meu-negocio/ServiceDialog'
import './MeuSite.css'

/** sugestões à vista antes do "Ver mais" */
const SUGGESTIONS_SHOWN = 6

/** resultado de gravar um serviço: o erro, ou o serviço como ficou no banco */
export type SaveServiceResult = { error: string } | { error: null; saved: ServiceInput & { id: string } }

const inputOf = (s: Service): ServiceInput => ({
  name: s.name,
  category: s.category,
  price: s.price,
  duration: s.duration,
  monthlyVolume: s.monthlyVolume,
  productId: s.productId,
})

/**
 * uma linha de serviço: foto, nome (toque para editar), preço editável ali mesmo e o botão "No site".
 * O preço é gravado ao sair do campo; foto e "No site" entram no rascunho e vão ao ar ao publicar.
 */
function ServiceRow({
  service,
  focusPrice,
  onPatch,
  onOpen,
  onSavePrice,
}: {
  service: Service
  focusPrice: boolean
  onPatch: (patch: Partial<Service>) => void
  onOpen: () => void
  onSavePrice: (price: number) => void
}) {
  const [price, setPrice] = useState(service.price)
  // o preço mudou fora daqui (na janela de edição): o campo acompanha
  const [seen, setSeen] = useState(service.price)
  if (seen !== service.price) {
    setSeen(service.price)
    setPrice(service.price)
  }
  const priceRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!focusPrice) return
    priceRef.current?.focus()
    priceRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusPrice])

  const commit = () => {
    if (price !== service.price) onSavePrice(price)
  }

  return (
    <li className={`row ${service.visible ? '' : 'is-hidden'}`.trim()}>
      <div className="row__top">
        <PhotoPick
          src={photoUrl(service)}
          label={service.name || 'serviço'}
          onPick={(photo) => onPatch({ photo })}
          onClear={() => onPatch({ photo: '', photoId: null })}
        />
        <button type="button" className="row__label row__label--btn" onClick={onOpen} aria-label={`Editar ${service.name}`}>
          <strong>{service.name}</strong>
          <small>
            {formatDuration(service.duration)}
            {service.price <= 0 && <span className="badge badge--pendente">Falta o preço</span>}
          </small>
        </button>
        <span className="input input--money row__price">
          <span aria-hidden="true">R$</span>
          <input
            ref={priceRef}
            aria-label={`Preço de ${service.name}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            value={price === 0 ? '' : price}
            placeholder="0"
            onChange={(e) => setPrice(parseAmount(e.target.value))}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </span>
        <Switch checked={service.visible} onChange={(v) => onPatch({ visible: v })} label="No site" />
      </div>
    </li>
  )
}

/** serviços prontos para adicionar com um toque, por área (as do negócio primeiro; "Outras áreas" mostra todas) */
function Suggestions({ services, onAdd }: { services: Service[]; onAdd: (segment: Segment, items: SuggestedService[]) => Promise<void> }) {
  const mine = businessAreas(services)
  const [showAll, setShowAll] = useState(mine.length === 0)
  const list = showAll ? SEGMENTS : mine
  const [areaId, setAreaId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const area = list.find((a) => a.id === areaId) ?? list[0]
  if (!area) return null
  const missing = missingSuggestions(area, services)
  // os mais comuns primeiro; o resto fica a um toque, para a lista não empurrar os serviços para longe
  const shown = expanded ? missing : missing.slice(0, SUGGESTIONS_SHOWN)

  const add = async (items: SuggestedService[]) => {
    if (busy) return
    setBusy(true)
    await onAdd(area, items)
    setBusy(false)
  }

  return (
    <section className="sugg" aria-label="Serviços prontos">
      <header className="sugg__head">
        <h3>Prontos para adicionar</h3>
        <p>Toque no + e depois só digite o preço.</p>
      </header>
      <div className="chips chips--scroll sugg__areas" role="group" aria-label="Área">
        {list.map((a) => (
          <button key={a.id} type="button" className="chip" aria-pressed={a.id === area.id} onClick={() => {
              setAreaId(a.id)
              setExpanded(false)
            }}>
            {a.label}
          </button>
        ))}
        {mine.length > 0 && (
          <button type="button" className="chip sugg__more" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Só as minhas áreas' : 'Outras áreas'}
          </button>
        )}
      </div>
      {missing.length === 0 ? (
        <p className="sugg__empty">Todos os serviços prontos de {area.label} já estão na sua lista.</p>
      ) : (
        <>
          <ul className="sugg__list">
            {shown.map((x) => (
              <li key={x.id}>
                <button type="button" className="sugg__item" disabled={busy} onClick={() => void add([x])} aria-label={`Adicionar ${x.name}`}>
                  <Plus size={15} aria-hidden="true" />
                  <span>{x.name}</span>
                  <small>{formatDuration(x.duration)}</small>
                </button>
              </li>
            ))}
            {missing.length > shown.length && (
              <li>
                <button type="button" className="sugg__item sugg__item--more" onClick={() => setExpanded(true)}>
                  Ver mais {missing.length - shown.length}
                </button>
              </li>
            )}
          </ul>
          {missing.length > 1 && (
            <button type="button" className="textlink sugg__all" disabled={busy} onClick={() => void add(missing)}>
              {busy ? 'Adicionando…' : `Adicionar todos de ${area.label} (${missing.length})`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

/**
 * parte "Serviços": cadastrar, pôr preço e escolher o que aparece, tudo aqui (sem ir para outra tela).
 * Nome, preço e duração são gravados na hora, valendo para a agenda; foto e "No site" vão ao ar ao publicar.
 */
export function ServicesEditor({
  services,
  products,
  onPatchService,
  onSaveService,
  onRemoveService,
}: {
  services: Service[]
  products: Product[]
  onPatchService: (id: string, patch: Partial<Service>) => void
  onSaveService: (input: ServiceInput, id?: string) => Promise<SaveServiceResult>
  onRemoveService: (id: string) => Promise<string | null>
}) {
  // categorias abertas por padrão (para pôr os preços de uma vez); guarda só as que foram fechadas
  const [closed, setClosed] = useState<Set<string>>(() => new Set())
  const toggle = (key: string) =>
    setClosed((g) => {
      const next = new Set(g)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const [removing, setRemoving] = useState<Service | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addSuggested = async (segment: Segment, items: SuggestedService[]) => {
    setError(null)
    let last: string | null = null
    for (const x of items) {
      const r = await onSaveService({ name: x.name, category: segment.category, price: 0, duration: x.duration, monthlyVolume: 0, productId: null })
      if (r.error !== null) {
        setError(r.error)
        break
      }
      last = r.saved.id
    }
    setClosed((g) => {
      const next = new Set(g)
      next.delete(segment.category)
      return next
    })
    // um só: o cursor já vai para o preço dele
    if (last && items.length === 1) setFocusId(last)
  }

  const savePrice = async (s: Service, price: number) => {
    setError(null)
    const r = await onSaveService({ ...inputOf(s), price }, s.id)
    if (r.error !== null) setError(r.error)
  }

  const remove = async (s: Service) => {
    setError(null)
    const message = await onRemoveService(s.id)
    if (message) setError(message)
  }

  const unpriced = services.filter((s) => s.price <= 0).length

  return (
    <div className="catalog">
      <div className="catalog__head">
        <p className="catalog__intro">
          {services.length === 0
            ? 'Comece pelos serviços prontos abaixo ou cadastre o seu.'
            : unpriced > 0
              ? `${unpriced} ${unpriced === 1 ? 'serviço está' : 'serviços estão'} sem preço. Sem preço, não aparece no agendamento online.`
              : 'Preço e duração valem para a agenda e para o site.'}
        </p>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden="true" /> Novo serviço
        </Button>
      </div>

      <Suggestions services={services} onAdd={addSuggested} />

      {error && (
        <p className="field__hint" role="alert">
          {error}
        </p>
      )}

      {CATEGORIES.filter((cat) => services.some((x) => x.category === cat)).map((cat) => {
        const list = services.filter((x) => x.category === cat)
        return (
          <Collapse key={cat} title={cat} meta={`${list.length} ${list.length === 1 ? 'serviço' : 'serviços'}`} open={!closed.has(cat)} onToggle={() => toggle(cat)}>
            <ul className="rows">
              {list.map((s) => (
                <ServiceRow
                  key={s.id}
                  service={s}
                  focusPrice={focusId === s.id}
                  onPatch={(patch) => onPatchService(s.id, patch)}
                  onOpen={() => setEditing(s)}
                  onSavePrice={(price) => void savePrice(s, price)}
                />
              ))}
            </ul>
          </Collapse>
        )
      })}


      {editing && (
        <ServiceDialog
          service={editing === 'new' ? null : editing}
          products={products}
          onClose={() => setEditing(null)}
          onSave={async (input) => (await onSaveService(input, editing === 'new' ? undefined : editing.id)).error}
          onRemove={
            editing === 'new'
              ? undefined
              : () => {
                  setRemoving(editing)
                  setEditing(null)
                }
          }
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Apagar ${removing.name}?`}
          text="O serviço sai da agenda e do site. Os atendimentos já feitos continuam no histórico com o nome dele."
          confirmLabel="Apagar"
          onClose={() => setRemoving(null)}
          onConfirm={() => void remove(removing)}
        />
      )}
    </div>
  )
}

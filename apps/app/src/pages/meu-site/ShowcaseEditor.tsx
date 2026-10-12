import { Plus, Trash2 } from 'lucide-react'
import { photoUrl, type ShowcaseItem } from '../../data/catalog'
import { SITE_LIMITS } from '../../domain/site'
import PhotoPick from '../../components/PhotoPick'
import { Switch } from '../../components/controls'
import { Button, MoneyInput } from '../../components/ui'
import './MeuSite.css'

/** etapa "Produtos à venda": a vitrine que a cliente vê, com pedido pelo WhatsApp */
export function ShowcaseEditor({
  items,
  onPatch,
  onAdd,
  onRemove,
}: {
  items: ShowcaseItem[]
  onPatch: (id: string, patch: Partial<ShowcaseItem>) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="catalog">
      <p className="catalog__intro">
        Produtos que você vende (óleos, cremes, kits). Aparecem na sua página com foto, preço e um botão para a cliente pedir pelo WhatsApp.
      </p>
      {items.length === 0 && <p className="catalog__empty">Nenhum produto ainda. Comece adicionando o primeiro.</p>}
      <ul className="rows">
        {items.map((x) => (
          <li key={x.id} className={`row ${x.visible ? '' : 'is-hidden'}`.trim()}>
            <div className="row__top">
              <PhotoPick
                src={photoUrl(x)}
                label={x.name || 'produto'}
                onPick={(photo) => onPatch(x.id, { photo })}
                onClear={() => onPatch(x.id, { photo: '', photoId: null })}
              />
              <span className="input row__name">
                <input
                  aria-label="Nome do produto à venda"
                  placeholder="Nome do produto"
                  value={x.name}
                  maxLength={60}
                  onChange={(e) => onPatch(x.id, { name: e.target.value })}
                />
              </span>
              <Switch checked={x.visible} onChange={(v) => onPatch(x.id, { visible: v })} label="No site" />
              <button type="button" className="chevbtn" aria-label={`Remover ${x.name || 'produto'}`} onClick={() => onRemove(x.id)}>
                <Trash2 size={15} />
              </button>
            </div>
            <div className="row__grid">
              <label className="mini-field">
                <span>Preço</span>
                <MoneyInput label="Preço" value={x.price} onChange={(v) => onPatch(x.id, { price: v })} />
              </label>
              <label className="mini-field mini-field--wide">
                <span>Descrição curta</span>
                <span className="input">
                  <input value={x.description} maxLength={120} placeholder="Ex.: hidrata e protege a cutícula" onChange={(e) => onPatch(x.id, { description: e.target.value })} />
                </span>
              </label>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="ghost" onClick={onAdd} disabled={items.length >= SITE_LIMITS.showcase} className="catalog__add">
        <Plus size={16} aria-hidden="true" /> Novo produto à venda
      </Button>
    </div>
  )
}

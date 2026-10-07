import { useId, useState, type ReactNode } from 'react'
import { ExternalLink, Plus, Rocket, Trash2, Undo2 } from 'lucide-react'
import {
  ACCENTS,
  CATEGORIES,
  computeMath,
  newId,
  useStudio,
  type AccentId,
  type Category,
  type Product,
  type Service,
  type SiteConfig,
} from '../data/catalog'
import { formatBRL } from '../lib/format'
import { useMediaQuery } from '../hooks/useMediaQuery'
import SitePreview from '../components/SitePreview'
import { Button, Card, Em } from '../components/ui'

type Tab = 'pagina' | 'servicos' | 'produtos' | 'previa'

const TABS: { id: Tab; label: string; narrowOnly?: boolean }[] = [
  { id: 'pagina', label: 'Página' },
  { id: 'servicos', label: 'Serviços e preços' },
  { id: 'produtos', label: 'Produtos e custos' },
  { id: 'previa', label: 'Prévia', narrowOnly: true },
]

const short = (v: number) => formatBRL(v).replace(',00', '')
const num = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0)

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      {children(id)}
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  )
}

function Money({ id, value, onChange, label }: { id?: string; value: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="input input--money">
      <span aria-hidden="true">R$</span>
      <input
        id={id}
        aria-label={id ? undefined : label}
        type="number"
        inputMode="decimal"
        min={0}
        step="1"
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => onChange(num(e.target.value))}
      />
    </span>
  )
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="switch">
      <span className="switch__text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden="true" />
    </label>
  )
}

export default function MeuSite() {
  const { draft, setDraft, dirty, publish, discard } = useStudio()
  const isWide = useMediaQuery('(min-width: 1100px)')
  const [tab, setTab] = useState<Tab>('pagina')
  const [justPublished, setJustPublished] = useState(false)

  const active: Tab = isWide && tab === 'previa' ? 'pagina' : tab
  const { site, services, products } = draft

  const setSite = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) =>
    setDraft((d) => ({ ...d, site: { ...d.site, [key]: value } }))
  const patchService = (id: string, patch: Partial<Service>) =>
    setDraft((d) => ({ ...d, services: d.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  const patchProduct = (id: string, patch: Partial<Product>) =>
    setDraft((d) => ({ ...d, products: d.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const addService = () =>
    setDraft((d) => ({
      ...d,
      services: [
        ...d.services,
        { id: newId('s'), name: '', category: 'Unhas', price: 0, duration: 60, monthlyVolume: 10, productId: null, visible: true },
      ],
    }))
  const removeService = (id: string) => setDraft((d) => ({ ...d, services: d.services.filter((s) => s.id !== id) }))
  const addProduct = () =>
    setDraft((d) => ({ ...d, products: [...d.products, { id: newId('p'), name: '', monthlySpend: 0 }] }))
  const removeProduct = (id: string) =>
    setDraft((d) => ({
      ...d,
      products: d.products.filter((p) => p.id !== id),
      services: d.services.map((s) => (s.productId === id ? { ...s, productId: null } : s)),
    }))

  const onPublish = () => {
    publish()
    setJustPublished(true)
    window.setTimeout(() => setJustPublished(false), 2500)
  }

  // resumo financeiro
  const totalSpend = products.reduce((s, p) => s + p.monthlySpend, 0)
  const revenue = services.reduce((s, sv) => s + sv.price * sv.monthlyVolume, 0)
  const avgMargin = revenue > 0 ? Math.round(((revenue - totalSpend) / revenue) * 100) : 0

  return (
    <div className="page page--fit">
      <header className="bar">
        <h1 className="bar__title">
          Meu <Em>site</Em>
        </h1>
        <div className="bar__side">
          <a className="mini mini--link" href={`#${site.slug}`} onClick={(e) => e.preventDefault()}>
            <span className="mini__key">ikizy.app/</span>
            <span className="mini__val">{site.slug || 'seu-salao'}</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          {dirty && (
            <Button variant="ghost" size="sm" onClick={discard}>
              <Undo2 size={15} aria-hidden="true" /> Descartar
            </Button>
          )}
          <Button size="sm" disabled={!dirty && !justPublished} onClick={onPublish}>
            <Rocket size={15} aria-hidden="true" />
            {justPublished ? 'Publicado!' : dirty ? 'Publicar alterações' : 'Tudo publicado'}
          </Button>
        </div>
      </header>

      <div className="studio">
        <Card className="studio__editor">
          <div className="tabs" role="tablist" aria-label="Seções do editor">
            {TABS.filter((t) => !t.narrowOnly || !isWide).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active === t.id}
                aria-controls="studio-panel"
                className="tab"
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="studio__body" id="studio-panel" role="tabpanel" aria-labelledby={`tab-${active}`}>
            {active === 'pagina' && (
              <div className="form">
                <Field label="Endereço da página" hint="É o link que você coloca no Instagram e no WhatsApp.">
                  {(id) => (
                    <span className="input input--prefix">
                      <span aria-hidden="true">ikizy.app/</span>
                      <input
                        id={id}
                        value={site.slug}
                        maxLength={40}
                        onChange={(e) => setSite('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      />
                    </span>
                  )}
                </Field>
                <Field label="Nome do salão">
                  {(id) => (
                    <span className="input">
                      <input id={id} value={site.salonName} maxLength={40} onChange={(e) => setSite('salonName', e.target.value)} />
                    </span>
                  )}
                </Field>
                <Field label="Frase de destaque" hint="A última palavra vira o destaque em itálico.">
                  {(id) => (
                    <span className="input">
                      <input id={id} value={site.tagline} maxLength={70} onChange={(e) => setSite('tagline', e.target.value)} />
                    </span>
                  )}
                </Field>
                <Field label="Sobre o salão">
                  {(id) => (
                    <span className="input input--area">
                      <textarea id={id} rows={3} value={site.about} maxLength={220} onChange={(e) => setSite('about', e.target.value)} />
                    </span>
                  )}
                </Field>
                <div className="form__pair">
                  <Field label="WhatsApp">
                    {(id) => (
                      <span className="input">
                        <input id={id} inputMode="tel" value={site.whatsapp} onChange={(e) => setSite('whatsapp', e.target.value)} />
                      </span>
                    )}
                  </Field>
                  <Field label="Instagram">
                    {(id) => (
                      <span className="input">
                        <input id={id} value={site.instagram} onChange={(e) => setSite('instagram', e.target.value)} />
                      </span>
                    )}
                  </Field>
                </div>
                <Field label="Horário de atendimento">
                  {(id) => (
                    <span className="input">
                      <input id={id} value={site.hours} maxLength={50} onChange={(e) => setSite('hours', e.target.value)} />
                    </span>
                  )}
                </Field>

                <fieldset className="field">
                  <legend className="field__label">Cor de destaque</legend>
                  <div className="swatches">
                    {(Object.keys(ACCENTS) as AccentId[]).map((id) => (
                      <label key={id} className="swatch">
                        <input type="radio" name="accent" checked={site.accent === id} onChange={() => setSite('accent', id)} />
                        <span className="swatch__dot" style={{ background: ACCENTS[id].color }} />
                        {ACCENTS[id].label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="form__toggles">
                  <Switch checked={site.showPrices} onChange={(v) => setSite('showPrices', v)} label="Mostrar preços na página" hint="Desligado, a cliente pede o valor no WhatsApp." />
                  <Switch checked={site.showTeam} onChange={(v) => setSite('showTeam', v)} label="Mostrar a equipe" />
                </div>
                <Field label="Sinal para confirmar o horário" hint="Cobrado via Pix no agendamento online. Use 0 para não cobrar.">
                  {(id) => (
                    <span className="input input--suffix">
                      <input
                        id={id}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        value={site.depositPercent}
                        onChange={(e) => setSite('depositPercent', Math.min(100, Math.round(num(e.target.value))))}
                      />
                      <span aria-hidden="true">%</span>
                    </span>
                  )}
                </Field>
              </div>
            )}

            {active === 'servicos' && (
              <div className="catalog">
                <p className="catalog__intro">
                  Defina o valor, o produto usado e quantos atendimentos faz por mês. O custo de produto e a sobra de cada serviço são
                  calculados sozinhos (sem contar comissão).
                </p>
                <ul className="rows">
                  {services.map((s) => {
                    const m = computeMath(s, services, products)
                    return (
                      <li key={s.id} className={`row ${s.visible ? '' : 'is-hidden'}`}>
                        <div className="row__top">
                          <span className="input row__name">
                            <input aria-label="Nome do serviço" placeholder="Nome do serviço" value={s.name} maxLength={50} onChange={(e) => patchService(s.id, { name: e.target.value })} />
                          </span>
                          <Switch checked={s.visible} onChange={(v) => patchService(s.id, { visible: v })} label="No site" />
                          <button type="button" className="chevbtn" aria-label={`Remover ${s.name || 'serviço'}`} onClick={() => removeService(s.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="row__grid">
                          <label className="mini-field">
                            <span>Categoria</span>
                            <span className="input input--select">
                              <select value={s.category} onChange={(e) => patchService(s.id, { category: e.target.value as Category })}>
                                {CATEGORIES.map((c) => (
                                  <option key={c}>{c}</option>
                                ))}
                              </select>
                            </span>
                          </label>
                          <label className="mini-field">
                            <span>Valor</span>
                            <Money label="Valor" value={s.price} onChange={(v) => patchService(s.id, { price: v })} />
                          </label>
                          <label className="mini-field">
                            <span>Duração (min)</span>
                            <span className="input">
                              <input type="number" inputMode="numeric" min={5} step={5} value={s.duration} onChange={(e) => patchService(s.id, { duration: Math.round(num(e.target.value)) })} />
                            </span>
                          </label>
                          <label className="mini-field">
                            <span>Atend./mês</span>
                            <span className="input">
                              <input type="number" inputMode="numeric" min={0} value={s.monthlyVolume} onChange={(e) => patchService(s.id, { monthlyVolume: Math.round(num(e.target.value)) })} />
                            </span>
                          </label>
                          <label className="mini-field mini-field--wide">
                            <span>Produto usado</span>
                            <span className="input input--select">
                              <select value={s.productId ?? ''} onChange={(e) => patchService(s.id, { productId: e.target.value || null })}>
                                <option value="">Nenhum</option>
                                {products
                                  .filter((p) => p.name.trim())
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                              </select>
                            </span>
                          </label>
                        </div>
                        <p className="row__math">
                          <span>Custo de produto <strong>{formatBRL(m.cost)}</strong></span>
                          <span>Sobra <strong>{formatBRL(m.margin)}</strong></span>
                          <span className={`margin ${m.marginPct < 60 ? 'margin--low' : ''}`}>{m.marginPct}% de margem</span>
                        </p>
                      </li>
                    )
                  })}
                </ul>
                <Button variant="ghost" onClick={addService} className="catalog__add">
                  <Plus size={16} aria-hidden="true" /> Novo serviço
                </Button>
              </div>
            )}

            {active === 'produtos' && (
              <div className="catalog">
                <div className="sumrow">
                  <div>
                    <p className="card__sub">Gasto com produtos / mês</p>
                    <p className="sumrow__value">{short(totalSpend)}</p>
                  </div>
                  <div>
                    <p className="card__sub">Faturamento estimado / mês</p>
                    <p className="sumrow__value">{short(revenue)}</p>
                  </div>
                  <div>
                    <p className="card__sub">Margem média</p>
                    <p className="sumrow__value">{avgMargin}%</p>
                  </div>
                </div>
                <ul className="rows">
                  {products.map((p) => {
                    const users = services.filter((s) => s.productId === p.id)
                    const volume = users.reduce((sum, s) => sum + s.monthlyVolume, 0)
                    const share = totalSpend > 0 ? Math.round((p.monthlySpend / totalSpend) * 100) : 0
                    return (
                      <li key={p.id} className="row">
                        <div className="row__top">
                          <span className="input row__name">
                            <input aria-label="Nome do produto" placeholder="Nome do produto" value={p.name} maxLength={50} onChange={(e) => patchProduct(p.id, { name: e.target.value })} />
                          </span>
                          <label className="mini-field mini-field--inline">
                            <span className="sr-only">Gasto médio por mês</span>
                            <Money label="Gasto médio por mês" value={p.monthlySpend} onChange={(v) => patchProduct(p.id, { monthlySpend: v })} />
                          </label>
                          <button type="button" className="chevbtn" aria-label={`Remover ${p.name || 'produto'}`} onClick={() => removeProduct(p.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="meter" role="img" aria-label={`${share}% do gasto total`}>
                          <span style={{ width: `${share}%` }} />
                        </div>
                        <p className="row__math">
                          <span>{share}% do gasto</span>
                          <span>
                            Usado em <strong>{users.length}</strong> {users.length === 1 ? 'serviço' : 'serviços'}
                          </span>
                          <span>
                            <strong>{volume > 0 ? formatBRL(p.monthlySpend / volume) : '—'}</strong> por atendimento
                          </span>
                        </p>
                      </li>
                    )
                  })}
                </ul>
                <Button variant="ghost" onClick={addProduct} className="catalog__add">
                  <Plus size={16} aria-hidden="true" /> Novo produto
                </Button>
              </div>
            )}

            {active === 'previa' && (
              <div className="phone phone--inline">
                <SitePreview studio={draft} />
              </div>
            )}
          </div>
        </Card>

        {isWide && (
          <Card variant="soft" className="studio__preview">
            <p className="studio__label">
              Prévia ao vivo
              {dirty && <span className="tag tag--aniversario">Não publicada</span>}
            </p>
            <div className="phone">
              <SitePreview studio={draft} />
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useAgenda } from '../data/AgendaProvider'
import { CATEGORIES, computeMath, type Category, type Product, type Service } from '../data/catalog'
import { useBusiness, type BusinessDetails, type ServiceInput } from '../data/business'
import { formatDuration, WEEKDAYS, type HourInterval } from '../lib/agendaTime'
import { formatBRL, formatTime } from '../lib/format'
import { Button, Card, Em } from '../components/ui'
import { MoneyField, Select, Stepper, parseMoney } from '../components/controls'
import { ConfirmDialog, Modal } from '../components/Modal'
import { WorkingHoursDialog } from '../components/WorkingHoursDialog'

const money = (v: number) => (v ? String(v).replace('.', ',') : '')
const short = (v: number) => formatBRL(v).replace(',00', '')

/** "Seg a Sex · 09:00–18:00" e "Sáb · 09:00–13:00": junta os dias seguidos com o mesmo horário */
function summarizeHours(list: HourInterval[] | undefined): string[] {
  if (!list || list.length === 0) return []
  const byDay = WEEKDAYS.map((d) => ({
    label: d.label.slice(0, 3),
    text: list
      .filter((i) => i.weekday === d.id)
      .sort((a, b) => a.start - b.start)
      .map((i) => `${formatTime(i.start)}–${formatTime(i.end)}`)
      .join(' e '),
  }))
  const out: string[] = []
  let i = 0
  while (i < byDay.length) {
    let j = i
    while (j + 1 < byDay.length && byDay[j + 1].text === byDay[i].text) j++
    if (byDay[i].text) out.push(`${byDay[i].label}${j > i ? ` a ${byDay[j].label}` : ''} · ${byDay[i].text}`)
    i = j + 1
  }
  return out
}

function DetailsCard({ details, canManage, onSave }: { details: BusinessDetails; canManage: boolean; onSave: (d: BusinessDetails) => Promise<string | null> }) {
  const [form, setForm] = useState(details)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => setForm(details), [details])
  const dirty = JSON.stringify(form) !== JSON.stringify(details)
  const set = (key: keyof BusinessDetails) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const error = await onSave(form)
    setBusy(false)
    setMessage(error ? { ok: false, text: error } : { ok: true, text: 'Dados salvos. O site usa estes contatos.' })
  }

  return (
    <Panel title="Dados do negócio" sub="Aparecem no seu site e nas mensagens para as clientes.">
      <form onSubmit={submit}>
        <div className="form biz__form">
          <label className="field">
            <span className="field__label">Nome do negócio</span>
            <span className="input">
              <input value={form.name} onChange={set('name')} required minLength={2} maxLength={60} disabled={!canManage} />
            </span>
          </label>
          <label className="field">
            <span className="field__label">WhatsApp</span>
            <span className="input">
              <input value={form.whatsapp} onChange={set('whatsapp')} inputMode="tel" placeholder="(11) 98765-4321" maxLength={20} disabled={!canManage} />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Instagram</span>
            <span className="input">
              <input value={form.instagram} onChange={set('instagram')} placeholder="@seunegocio" maxLength={40} disabled={!canManage} />
            </span>
          </label>
          <label className="field biz__wide">
            <span className="field__label">Endereço</span>
            <span className="input">
              <input value={form.address} onChange={set('address')} placeholder="Rua, número, bairro, cidade" maxLength={120} disabled={!canManage} />
            </span>
          </label>
        </div>
        {message && (
          <p className={message.ok ? 'alert alert--ok' : 'dialog__error'} role={message.ok ? 'status' : 'alert'}>
            {message.text}
          </p>
        )}
        {canManage && (
          <div className="biz__actions">
            <Button type="submit" disabled={busy || !dirty}>
              {busy ? 'Salvando…' : 'Salvar dados'}
            </Button>
          </div>
        )}
      </form>
    </Panel>
  )
}

/** uma seção por vez: título, explicação e (se houver) o botão principal à direita */
function Panel({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="biz__panel">
      <div className="biz__panelhead">
        <div>
          <h2 className="card__title">{title}</h2>
          {sub && <p className="card__sub">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

function ServiceDialog({
  service,
  products,
  onSave,
  onRemove,
  onClose,
}: {
  service: Service | null
  products: Product[]
  onSave: (input: ServiceInput) => Promise<string | null>
  onRemove?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(service?.name ?? '')
  const [category, setCategory] = useState<Category>(service?.category ?? 'Unhas')
  const [price, setPrice] = useState(money(service?.price ?? 0))
  const [duration, setDuration] = useState(service?.duration ?? 60)
  const [productId, setProductId] = useState(service?.productId ?? '')
  const [volume, setVolume] = useState(String(service?.monthlyVolume ?? 0))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const message = await onSave({
      name,
      category,
      price: parseMoney(price),
      duration,
      productId: productId || null,
      monthlyVolume: Number(volume) || 0,
    })
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal label={service ? 'Editar serviço' : 'Novo serviço'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog__head">
          <h2>
            {service ? 'Editar' : 'Novo'} <Em>serviço</Em>
          </h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="form">
          <label className="field">
            <span className="field__label">Nome</span>
            <span className="input">
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoFocus={!service} placeholder="Ex.: Esmaltação em gel" />
            </span>
          </label>
          <Select label="Categoria" value={category} options={CATEGORIES.map((c) => ({ value: c, label: c }))} onChange={(v) => setCategory(v as Category)} />
          <div className="form__pair">
            <MoneyField label="Preço" value={price} onChange={setPrice} />
            <Stepper label="Duração" value={duration} onChange={setDuration} format={formatDuration} min={5} max={600} step={15} />
          </div>
          <details className="biz__more" open={Boolean(service?.productId)}>
            <summary>Custo de material (opcional)</summary>
            <p className="field__hint">Para calcular quanto sobra de cada atendimento. Cadastre os materiais em "Custos de material".</p>
            <div className="form__pair">
              <Select
                label="Material usado"
                value={productId}
                options={[{ value: '', label: 'Nenhum' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
                onChange={setProductId}
              />
              <label className="field">
                <span className="field__label">Atendimentos por mês</span>
                <span className="input">
                  <input type="number" inputMode="numeric" min={0} value={volume} onChange={(e) => setVolume(e.target.value)} />
                </span>
              </label>
            </div>
          </details>
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          {onRemove ? (
            <Button variant="light" onClick={onRemove}>
              <Trash2 size={16} aria-hidden="true" /> Apagar
            </Button>
          ) : (
            <Button variant="light" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ProductDialog({
  product,
  onSave,
  onRemove,
  onClose,
}: {
  product: Product | null
  onSave: (input: Pick<Product, 'name' | 'monthlySpend'>) => Promise<string | null>
  onRemove?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [spend, setSpend] = useState(money(product?.monthlySpend ?? 0))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const message = await onSave({ name, monthlySpend: parseMoney(spend) })
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal label={product ? 'Editar material' : 'Novo material'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog__head">
          <h2>
            {product ? 'Editar' : 'Novo'} <Em>material</Em>
          </h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="form">
          <label className="field">
            <span className="field__label">Nome</span>
            <span className="input">
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoFocus={!product} placeholder="Ex.: Gel e esmaltes" />
            </span>
          </label>
          <MoneyField label="Gasto médio por mês" value={spend} onChange={setSpend} />
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          {onRemove ? (
            <Button variant="light" onClick={onRemove}>
              <Trash2 size={16} aria-hidden="true" /> Apagar
            </Button>
          ) : (
            <Button variant="light" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

const TABS = [
  { id: 'dados', label: 'Dados' },
  { id: 'horario', label: 'Horário' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'custos', label: 'Materiais' },
] as const
type TabId = (typeof TABS)[number]['id']

/** /dashboard/negocio: tudo que é do negócio (dados, horário, serviços, custos), uma seção por vez em abas */
export default function MeuNegocio() {
  const { salon } = useAuth()
  const { professionals, workingHours, reload: reloadAgenda } = useAgenda()
  const biz = useBusiness()
  const { hash, state } = useLocation()
  const navigate = useNavigate()
  // a aba fica no endereço (#servicos): os atalhos dos primeiros passos e o voltar do navegador funcionam
  const tab: TabId = TABS.find((t) => hash === '#' + t.id)?.id ?? 'dados'
  const canManage = !salon || salon.role === 'owner' || salon.role === 'manager'
  const [editingHours, setEditingHours] = useState(false)
  const [service, setService] = useState<Service | 'new' | null>(null)
  const [product, setProduct] = useState<Product | 'new' | null>(null)
  const [removing, setRemoving] = useState<{ kind: 'service' | 'product'; id: string; name: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // vindo dos primeiros passos (#horario), já abre a edição do horário; trocar de aba pelo menu não abre
  useEffect(() => {
    if (biz.loading || hash !== '#horario' || !canManage) return
    if (!(state as { tab?: boolean } | null)?.tab) setEditingHours(true)
  }, [hash, state, biz.loading, canManage])

  // a agenda guarda a lista de serviços para marcar horário: atualiza depois de mexer aqui
  const afterServices = (message: string | null, ok: string) => {
    if (!message) {
      reloadAgenda()
      setToast(ok)
    }
    return message
  }

  const unpriced = biz.services.filter((s) => s.price <= 0).length
  const totalSpend = biz.products.reduce((sum, p) => sum + p.monthlySpend, 0)

  return (
    <div className="page biz">
      <header className="bar">
        <h1 className="bar__title">
          Meu <Em>negócio</Em>
        </h1>
      </header>

      {biz.error && (
        <p className="dialog__error" role="alert">
          {biz.error}{' '}
          <button type="button" className="textlink" onClick={biz.reload}>
            Tentar de novo
          </button>
        </p>
      )}
      {!canManage && <p className="alert">Só a dona ou a gerente alteram os dados do negócio. Você pode consultar.</p>}

      {biz.loading ? (
        <p className="card__sub" role="status">
          Carregando…
        </p>
      ) : (
        <>
          <div className="biz__tabs">
            <div className="seg" role="tablist" aria-label="Seções do negócio">
              {TABS.map((t) => {
                const count = t.id === 'servicos' ? biz.services.length : t.id === 'custos' ? biz.products.length : null
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => navigate({ hash: '#' + t.id }, { replace: true, state: { tab: true } })}
                  >
                    {t.label}
                    {count ? <small className="biz__count">{count}</small> : null}
                  </button>
                )
              })}
            </div>
          </div>

          {tab === 'dados' && <DetailsCard details={biz.details} canManage={canManage} onSave={biz.saveDetails} />}

          {tab === 'horario' && (
            <Panel
              title="Horário de atendimento"
              sub="O site só oferece horários dentro dele; a agenda mostra o resto hachurado."
              action={
                canManage && professionals.length > 0 ? (
                  <Button size="sm" onClick={() => setEditingHours(true)}>
                    Editar horário
                  </Button>
                ) : null
              }
            >
              {professionals.length === 0 ? (
                <p className="card__sub">Cadastre quem atende na agenda para definir o horário.</p>
              ) : (
                <ul className="biz__list">
                  {professionals.map((p) => {
                    const lines = summarizeHours(workingHours[p.id])
                    return (
                      <li key={p.id} className="biz__item biz__item--static">
                        <span className="biz__item-text">
                          <strong>{p.name}</strong>
                          <small>{lines.length ? lines.join(' · ') : 'Ainda não definido'}</small>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          )}

          {tab === 'servicos' && (
            <Panel
              title="Serviços"
              sub={
                (biz.services.length === 0
                  ? 'Nenhum serviço ainda'
                  : `${biz.services.length} ${biz.services.length === 1 ? 'serviço' : 'serviços'}${unpriced ? ` · ${unpriced} sem preço` : ''}`) +
                '. Foto e o que aparece no site ficam no Meu site.'
              }
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setService('new')}>
                    <Plus size={16} aria-hidden="true" /> Novo serviço
                  </Button>
                ) : null
              }
            >
              {CATEGORIES.filter((c) => biz.services.some((s) => s.category === c)).map((cat) => (
                <div key={cat} className="biz__group">
                  <p className="biz__group-title">{cat}</p>
                  <ul className="biz__list">
                    {biz.services
                      .filter((s) => s.category === cat)
                      .map((s) => {
                        const m = computeMath(s, biz.services, biz.products)
                        return (
                          <li key={s.id}>
                            <button type="button" className="biz__item" disabled={!canManage} onClick={() => setService(s)}>
                              <span className="biz__item-text">
                                <strong>{s.name}</strong>
                                <small>
                                  {formatDuration(s.duration)}
                                  {s.productId && s.price > 0 ? ` · sobra ${short(m.margin)} (${m.marginPct}%)` : ''}
                                </small>
                              </span>
                              {s.price > 0 ? <span className="biz__price">{short(s.price)}</span> : <span className="badge badge--pendente">Sem preço</span>}
                              {canManage && <ChevronRight size={16} aria-hidden="true" />}
                            </button>
                          </li>
                        )
                      })}
                  </ul>
                </div>
              ))}
            </Panel>
          )}

          {tab === 'custos' && (
            <Panel
              title="Custos de material"
              sub={`Só para você: entram no lucro do Financeiro e na sobra de cada serviço.${totalSpend > 0 ? ` Total ${short(totalSpend)} por mês.` : ''}`}
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setProduct('new')}>
                    <Plus size={16} aria-hidden="true" /> Novo material
                  </Button>
                ) : null
              }
            >
              {biz.products.length === 0 ? (
                <p className="card__sub">Nenhum material cadastrado.</p>
              ) : (
                <ul className="biz__list">
                  {biz.products.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="biz__item" disabled={!canManage} onClick={() => setProduct(p)}>
                        <span className="biz__item-text">
                          <strong>{p.name}</strong>
                          <small>Usado em {biz.services.filter((s) => s.productId === p.id).length} serviço(s)</small>
                        </span>
                        <span className="biz__price">{short(p.monthlySpend)}/mês</span>
                        {canManage && <ChevronRight size={16} aria-hidden="true" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </>
      )}

      {editingHours && <WorkingHoursDialog onClose={() => setEditingHours(false)} notify={setToast} />}
      {service && (
        <ServiceDialog
          service={service === 'new' ? null : service}
          products={biz.products}
          onClose={() => setService(null)}
          onSave={async (input) =>
            afterServices(await biz.saveService(input, service === 'new' ? undefined : service.id), service === 'new' ? 'Serviço criado' : 'Serviço salvo')
          }
          onRemove={service === 'new' ? undefined : () => setRemoving({ kind: 'service', id: service.id, name: service.name })}
        />
      )}
      {product && (
        <ProductDialog
          product={product === 'new' ? null : product}
          onClose={() => setProduct(null)}
          onSave={async (input) => {
            const message = await biz.saveProduct(input, product === 'new' ? undefined : product.id)
            if (!message) setToast('Material salvo')
            return message
          }}
          onRemove={product === 'new' ? undefined : () => setRemoving({ kind: 'product', id: product.id, name: product.name })}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Apagar ${removing.name}?`}
          text={
            removing.kind === 'service'
              ? 'O serviço sai da agenda e do site. Os atendimentos já feitos continuam no histórico com o nome dele.'
              : 'Os serviços que usavam este material ficam sem custo de material.'
          }
          confirmLabel="Apagar"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            const r = removing
            setRemoving(null)
            setService(null)
            setProduct(null)
            const message = r.kind === 'service' ? afterServices(await biz.removeService(r.id), 'Serviço apagado') : await biz.removeProduct(r.id)
            if (message) setToast(message)
            else if (r.kind === 'product') setToast('Material apagado')
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

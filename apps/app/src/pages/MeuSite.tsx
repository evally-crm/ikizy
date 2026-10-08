import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, ChevronDown, ExternalLink, ImagePlus, Maximize2, Plus, Rocket, Trash2, Undo2, X } from 'lucide-react'
import {
  PALETTES,
  CATEGORIES,
  computeMath,
  newId,
  useStudio,
  type PaletteId,
  type Category,
  type Product,
  type Service,
  type SiteConfig,
  photoUrl,
  type ShowcaseItem,
} from '../data/catalog'
import { formatBRL } from '../lib/format'
import { resizeToDataUrl } from '../lib/imageResize'
import { FONTS, type FontId } from '../lib/siteTheme'
import { isReservedSlug, SITE_DOMAIN, siteHost } from '../lib/slug'
import { useMediaQuery } from '../hooks/useMediaQuery'
import SiteFrame, { DeviceToggle, type Device } from '../components/SiteFrame'
import OnlineBookingChecklist from '../components/OnlineBookingChecklist'
import PhotoPick from '../components/PhotoPick'
import { Button, Card, Em } from '../components/ui'

type Tab = 'pagina' | 'servicos' | 'vitrine' | 'produtos' | 'previa'

const TABS: { id: Tab; label: string; narrowOnly?: boolean }[] = [
  { id: 'pagina', label: 'Página' },
  { id: 'servicos', label: 'Serviços e preços' },
  { id: 'vitrine', label: 'Produtos à venda' },
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

/** bloco do editor: título e uma frase curta; abre e fecha para a tela não ficar longa no celular */
function Section({ title, hint, open, children }: { title: string; hint?: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="sect" open={open}>
      <summary className="sect__head">
        <span>
          <strong>{title}</strong>
          {hint && <small>{hint}</small>}
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="form">{children}</div>
    </details>
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
  const { draft, setDraft, dirty, publish, discard, loading, error: loadError, isLive, publishedSlug } = useStudio()
  const isWide = useMediaQuery('(min-width: 1100px)')
  const splitGuide = useMediaQuery('(min-width: 900px)')
  const [tab, setTab] = useState<Tab>('pagina')
  const [justPublished, setJustPublished] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [wizardOn, setWizardOn] = useState<boolean | null>(null)
  const [fullPref, setFullPref] = useState(true)
  const [device, setDevice] = useState<Device>(isWide ? 'desktop' : 'mobile')
  const [logoError, setLogoError] = useState<string | null>(null)
  const logoInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  const active: Tab = isWide && tab === 'previa' ? 'pagina' : tab
  const { site, services, products, showcase } = draft
  const slugReserved = isReservedSlug(site.slug)

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
        { id: newId('s'), name: '', category: 'Unhas', price: 0, duration: 60, monthlyVolume: 10, productId: null, visible: true, photo: '', photoId: null },
      ],
    }))
  const removeService = (id: string) => setDraft((d) => ({ ...d, services: d.services.filter((s) => s.id !== id) }))
  const patchShowcase = (id: string, patch: Partial<ShowcaseItem>) =>
    setDraft((d) => ({ ...d, showcase: d.showcase.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  const addShowcase = () =>
    setDraft((d) => ({
      ...d,
      showcase: [...d.showcase, { id: newId('v'), name: '', description: '', price: 0, visible: true, photo: '', photoId: null }],
    }))
  const removeShowcase = (id: string) => setDraft((d) => ({ ...d, showcase: d.showcase.filter((x) => x.id !== id) }))
  const addProduct = () =>
    setDraft((d) => ({ ...d, products: [...d.products, { id: newId('p'), name: '', monthlySpend: 0 }] }))
  const removeProduct = (id: string) =>
    setDraft((d) => ({
      ...d,
      products: d.products.filter((p) => p.id !== id),
      services: d.services.map((s) => (s.productId === id ? { ...s, productId: null } : s)),
    }))

  const onImage = async (e: ChangeEvent<HTMLInputElement>, kind: 'logo' | 'cover') => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoError(null)
    try {
      setSite(kind, kind === 'logo' ? await resizeToDataUrl(file) : await resizeToDataUrl(file, 1000, 280_000))
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Não foi possível usar essa imagem.')
    }
  }

  const onPublish = async () => {
    setPublishing(true)
    setPublishError(null)
    const problem = await publish()
    setPublishing(false)
    if (problem) {
      setPublishError(problem)
      return
    }
    setJustPublished(true)
    window.setTimeout(() => setJustPublished(false), 2500)
  }

  // resumo financeiro
  const totalSpend = products.reduce((s, p) => s + p.monthlySpend, 0)
  const revenue = services.reduce((s, sv) => s + sv.price * sv.monthlyVolume, 0)
  const avgMargin = revenue > 0 ? Math.round(((revenue - totalSpend) / revenue) * 100) : 0

  const fieldsIdentity = (
    <>
      <div className="logofield">
        <span className="logofield__thumb" aria-hidden="true">
          {site.logo ? <img src={site.logo} alt="" /> : <ImagePlus size={22} />}
        </span>
        <div className="logofield__text">
          <p>{site.logo ? 'Seu logo' : 'Adicione seu logo'}</p>
          <small>PNG, JPG ou WebP</small>
        </div>
        <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void onImage(e, 'logo')} />
        <Button variant="light" size="sm" onClick={() => logoInput.current?.click()}>
          {site.logo ? 'Trocar' : 'Escolher'}
        </Button>
        {site.logo && (
          <button type="button" className="chevbtn" aria-label="Remover logo" onClick={() => setSite('logo', '')}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
      <div className="logofield">
        <span className="logofield__thumb logofield__thumb--wide" aria-hidden="true">
          {site.cover ? <img src={site.cover} alt="" /> : <ImagePlus size={22} />}
        </span>
        <div className="logofield__text">
          <p>{site.cover ? 'Foto de capa' : 'Adicione uma foto de capa'}</p>
          <small>Foto grande do topo do site</small>
        </div>
        <input ref={coverInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void onImage(e, 'cover')} />
        <Button variant="light" size="sm" onClick={() => coverInput.current?.click()}>
          {site.cover ? 'Trocar' : 'Escolher'}
        </Button>
        {site.cover && (
          <button type="button" className="chevbtn" aria-label="Remover foto de capa" onClick={() => setSite('cover', '')}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {logoError && (
        <p className="field__hint" role="alert">
          {logoError}
        </p>
      )}

    </>
  )

  const fieldsText = (
    <>
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
    </>
  )

  const fieldsContact = (
    <>
      <Field
        label="Endereço da página"
        hint={slugReserved ? 'Esse endereço é reservado. Escolha outro.' : 'É o link que você coloca no Instagram e no WhatsApp.'}
      >
        {(id) => (
          <span className="input input--suffix">
            <input
              id={id}
              value={site.slug}
              maxLength={40}
              aria-invalid={slugReserved}
              onChange={(e) => setSite('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
            <span aria-hidden="true">.{SITE_DOMAIN}</span>
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
      <Field label="Endereço do salão" hint="Aparece na página com link para o mapa. Deixe vazio se atende em domicílio.">
        {(id) => (
          <span className="input">
            <input id={id} value={site.address} maxLength={120} autoComplete="street-address" onChange={(e) => setSite('address', e.target.value)} />
          </span>
        )}
      </Field>
      <Field label="Horário de atendimento">
        {(id) => (
          <span className="input">
            <input id={id} value={site.hours} maxLength={50} onChange={(e) => setSite('hours', e.target.value)} />
          </span>
        )}
      </Field>
    </>
  )

  const fieldsShow = (
    <>
      <div className="form__toggles">
        <Switch checked={site.showPrices} onChange={(v) => setSite('showPrices', v)} label="Mostrar preços na página" hint="Desligado, a cliente pede o valor no WhatsApp." />
        <Switch checked={site.showTeam} onChange={(v) => setSite('showTeam', v)} label="Mostrar a equipe" />
      </div>
      <Switch
        checked={site.onlineBooking}
        onChange={(v) => setSite('onlineBooking', v)}
        label="Aceitar agendamentos online"
        hint="A cliente escolhe serviço, dia e horário livre na sua página. O pedido cai na agenda como pendente."
      />
      {site.onlineBooking && (
        <>
          <div className="form__pair">
            <Field label="Antecedência mínima" hint="Horas antes do atendimento.">
              {(id) => (
                <span className="input input--suffix">
                  <input id={id} type="number" inputMode="numeric" min={0} max={168} value={site.bookingNoticeHours} onChange={(e) => setSite('bookingNoticeHours', Math.min(168, Math.round(num(e.target.value))))} />
                  <span aria-hidden="true">h</span>
                </span>
              )}
            </Field>
            <Field label="Agendar até" hint="Dias à frente.">
              {(id) => (
                <span className="input input--suffix">
                  <input id={id} type="number" inputMode="numeric" min={1} max={90} value={site.bookingWindowDays} onChange={(e) => setSite('bookingWindowDays', Math.min(90, Math.max(1, Math.round(num(e.target.value)))))} />
                  <span aria-hidden="true">dias</span>
                </span>
              )}
            </Field>
          </div>
          <p className="field__hint">Só aparecem horários dentro do expediente de cada profissional. Defina o expediente na Agenda, em Horário de atendimento.</p>
        </>
      )}
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
    </>
  )

  const servicesEditor = (
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
                <PhotoPick
                  src={photoUrl(s)}
                  label={s.name || 'serviço'}
                  onPick={(photo) => patchService(s.id, { photo })}
                  onClear={() => patchService(s.id, { photo: '', photoId: null })}
                />
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
  )

  const fieldsPalette = (
    <fieldset className="field">
      <legend className="field__label">Paleta de cores</legend>
      <div className="swatches">
        {(Object.keys(PALETTES) as PaletteId[]).map((id) => {
          const p = PALETTES[id]
          return (
            <label key={id} className="swatch">
              <input type="radio" name="palette" checked={site.palette === id} onChange={() => setSite('palette', id)} />
              <span className="swatch__dot swatch__dot--duo" style={{ background: `linear-gradient(135deg, ${p.bg} 50%, ${p.accent} 50%)` }} />
              {p.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )

  const fieldsFont = (
    <fieldset className="field">
      <legend className="field__label">Fonte dos títulos</legend>
      <div className="swatches">
        {(Object.keys(FONTS) as FontId[]).map((id) => (
          <label key={id} className="swatch swatch--font">
            <input type="radio" name="font" checked={site.font === id} onChange={() => setSite('font', id)} />
            <span style={{ fontFamily: FONTS[id].family, fontWeight: FONTS[id].weight, textTransform: FONTS[id].upper ? 'uppercase' : 'none' }}>
              {FONTS[id].label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )

  const fieldsLook = (
    <>
      {fieldsPalette}
      {fieldsFont}
    </>
  )

  // guia de criação: abre sozinho para quem ainda não publicou; ?guia=1 abre de novo
  const forced = new URLSearchParams(window.location.search).has('guia')
  const wizard = !loading && !loadError && (wizardOn ?? (!isLive || forced))
  // tela cheia: padrão em telas largas; o X minimiza só nesta visita
  const full = fullPref && isWide
  const setFull = setFullPref
  useEffect(() => {
    if (!full) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !wizard && setFull(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [full, wizard])
  // trava a rolagem da página enquanto o guia está aberto
  useEffect(() => {
    if (!wizard) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [wizard])
  const addressOk = site.salonName.trim().length >= 2 && site.slug.length >= 3 && !slugReserved
  const closeWizard = () => setWizardOn(false)
  const claim = async () => {
    setPublishing(true)
    setPublishError(null)
    const problem = await publish()
    setPublishing(false)
    if (problem) {
      setPublishError(problem)
      return
    }
    setWizardOn(true)
    setStep(2)
  }

  const wizardOverlay = (
    <div className="gg" role="dialog" aria-modal="true" aria-label="Criar seu site">
      <header className="gg__head">
        <span className="gg__logo">
          IKIZY<b>.</b>
        </span>
        <button type="button" className="gg__x" aria-label="Fechar o guia" onClick={closeWizard}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="gg__main">
        <section className="gg__form">
          {step === 0 && (
            <>
              <p className="gg__eyebrow">Criar seu site · passo 1 de 2</p>
              <h2 className="gg__title">Escolha o visual</h2>
              <p className="gg__sub">São só duas escolhas, com cores já combinadas. Você muda quando quiser.</p>
              {fieldsLook}
            </>
          )}
          {step === 1 && (
            <>
              <p className="gg__eyebrow">Criar seu site · passo 2 de 2</p>
              <h2 className="gg__title">{isLive ? 'Confirme o endereço do seu site' : 'Escolha o endereço do seu site'}</h2>
              <p className="gg__sub">É o link que você divulga no Instagram e no WhatsApp.</p>
              <Field label="Nome do seu salão">
                {(id) => (
                  <span className="input">
                    <input id={id} value={site.salonName} maxLength={40} onChange={(e) => setSite('salonName', e.target.value)} />
                  </span>
                )}
              </Field>
              <Field label="Endereço do site" hint={slugReserved ? 'Esse endereço é reservado. Escolha outro.' : 'Você pode mudar depois.'}>
                {(id) => (
                  <span className="input input--suffix">
                    <input
                      id={id}
                      value={site.slug}
                      maxLength={40}
                      aria-invalid={slugReserved}
                      onChange={(e) => setSite('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    />
                    <span aria-hidden="true">.{SITE_DOMAIN}</span>
                  </span>
                )}
              </Field>
            </>
          )}
          {step === 2 && (
            <>
              <p className="gg__eyebrow">Tudo certo</p>
              <h2 className="gg__title">
                Pronto! Seu site <Em>está no ar</Em>.
              </h2>
              <p className="gg__sub">Agora é só completar: logo, foto de capa, textos, contato e serviços. Leva poucos minutos.</p>
              <div className="gg__done">
                <a className="gg__btn gg__btn--light" href={`https://${siteHost(publishedSlug)}`} target="_blank" rel="noreferrer">
                  Ver meu site
                </a>
                <button
                  type="button"
                  className="gg__btn"
                  onClick={() => {
                    closeWizard()
                    setTab('pagina')
                  }}
                >
                  Completar meu site
                </button>
              </div>
            </>
          )}
          {publishError && (
            <p className="field__hint" role="alert">
              {publishError}
            </p>
          )}
        </section>

        <section className="gg__preview" aria-label="Prévia do seu site">
          {splitGuide && <DeviceToggle device={device} onChange={setDevice} />}
          <div className="gg__frame">
            <SiteFrame studio={draft} device={splitGuide ? device : 'mobile'} height={splitGuide ? 'fill' : 240} />
          </div>
        </section>
      </div>

      <footer className="gg__foot">
        <ol className="gg__bars" aria-label="Progresso">
          {[0, 1, 2].map((i) => (
            <li key={i} className={i < step ? 'is-done' : i === step ? 'is-now' : ''} />
          ))}
        </ol>
        {step < 2 && (
          <div className="gg__nav">
            {step > 0 && (
              <button type="button" className="gg__back" aria-label="Voltar" disabled={publishing} onClick={() => setStep(step - 1)}>
                <ArrowLeft size={20} aria-hidden="true" />
              </button>
            )}
            {step === 0 ? (
              <button type="button" className="gg__btn" onClick={() => setStep(1)}>
                Continuar <ArrowRight size={18} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="gg__btn" disabled={!addressOk || publishing} onClick={() => void claim()}>
                <Rocket size={18} aria-hidden="true" />
                {publishing ? 'Salvando…' : isLive ? 'Salvar alterações' : 'Publicar site'}
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  )

  const root = (
    <div className={`page page--fit ${full ? 'sfull' : ''}`}>
      <header className="bar">
        <h1 className="bar__title">
          Meu <Em>site</Em>
        </h1>
        <div className="bar__side">
          {isLive ? (
            <a className="mini mini--link" href={`https://${siteHost(publishedSlug)}`} target="_blank" rel="noreferrer">
              <span className="mini__val">{siteHost(publishedSlug)}</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          ) : (
            <span className="mini">
              <span className="mini__val">{siteHost(site.slug)} · ainda não publicado</span>
            </span>
          )}
          <div className={`bar__publish ${wizard ? 'is-off' : ''}`}>
            {dirty && (
              <Button variant="ghost" size="sm" onClick={discard}>
                <Undo2 size={15} aria-hidden="true" /> Descartar
              </Button>
            )}
            <Button size="sm" disabled={(!dirty && !justPublished && isLive) || slugReserved || publishing || loading} onClick={() => void onPublish()}>
              <Rocket size={15} aria-hidden="true" />
              {publishing ? 'Publicando…' : justPublished ? 'Publicado!' : !isLive ? 'Publicar site' : dirty ? 'Publicar alterações' : 'Tudo publicado'}
            </Button>
          </div>
          {isWide &&
            (full ? (
              <button type="button" className="sfull__x" aria-label="Minimizar" title="Minimizar (Esc)" onClick={() => setFull(false)}>
                <X size={20} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="mini mini--link" onClick={() => setFull(true)}>
                <Maximize2 size={14} aria-hidden="true" />
                <span className="mini__val">Tela cheia</span>
              </button>
            ))}
        </div>
      </header>

      {(dirty || !isLive) && !wizard && (
        <div className="publishbar" role="region" aria-label="Publicar o site">
          {dirty && (
            <Button variant="light" size="sm" onClick={discard}>
              <Undo2 size={15} aria-hidden="true" /> Descartar
            </Button>
          )}
          <Button size="sm" disabled={slugReserved || publishing || loading} onClick={() => void onPublish()}>
            <Rocket size={15} aria-hidden="true" />
            {publishing ? 'Publicando…' : !isLive ? 'Publicar site' : 'Publicar alterações'}
          </Button>
        </div>
      )}

      {(loadError || publishError) && (
        <p className="field__hint" role="alert">
          {loadError ?? publishError}
        </p>
      )}

      <div className="studio">
        <Card className="studio__editor">
          {(() => {
            const tabs = TABS.filter((t) => !t.narrowOnly || !isWide)
            const at = Math.max(0, tabs.findIndex((t) => t.id === active))
            return (
              <div className="stepbar">
                <div className="stepbar__bars" role="tablist" aria-label="Seções do editor">
                  {tabs.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      id={`tab-${t.id}`}
                      aria-selected={active === t.id}
                      aria-controls="studio-panel"
                      aria-label={t.label}
                      title={t.label}
                      className={i <= at ? 'is-done' : undefined}
                      onClick={() => setTab(t.id)}
                    >
                      <i />
                    </button>
                  ))}
                </div>
                <p className="stepbar__label">{tabs[at].label}</p>
              </div>
            )
          })()}

          <div className="studio__body" id="studio-panel" role="tabpanel" aria-labelledby={`tab-${active}`}>
            {active === 'pagina' && (
              <div className="sects">
                <div className="guidecard">
                  <span>
                    <strong>Personalizar em 2 passos</strong>
                    <small>Visual e endereço, com a prévia ao lado.</small>
                  </span>
                  <Button
                    variant="light"
                    size="sm"
                    onClick={() => {
                      setStep(0)
                      setWizardOn(true)
                    }}
                  >
                    Abrir guia
                  </Button>
                </div>
                <details className="fold">
                  <summary>Agendamento pelo site</summary>
                  <OnlineBookingChecklist whatsapp={site.whatsapp} online={site.onlineBooking} />
                </details>

                <Section title="Aparência" hint="Paleta e fonte.">
                  {fieldsLook}
                </Section>

                <Section title="Identidade" hint="Logo e foto de capa.">
                  {fieldsIdentity}
                </Section>

                <Section title="Textos" hint="O que a cliente lê primeiro.">
                  {fieldsText}
                </Section>

                <Section title="Contato e endereço" hint="Como a cliente fala com você e encontra a página.">
                  {fieldsContact}
                </Section>

                <Section title="O que mostrar" hint="Preços, equipe e sinal.">
                  {fieldsShow}
                </Section>
              </div>
            )}

            {active === 'servicos' && servicesEditor}

            {active === 'vitrine' && (
              <div className="catalog">
                <p className="catalog__intro">
                  Produtos que você vende (óleos, cremes, kits). Aparecem na sua página com foto, preço e um botão para a cliente pedir pelo WhatsApp.
                </p>
                {showcase.length === 0 && <p className="catalog__empty">Nenhum produto ainda. Comece adicionando o primeiro.</p>}
                <ul className="rows">
                  {showcase.map((x) => (
                    <li key={x.id} className={`row ${x.visible ? '' : 'is-hidden'}`}>
                      <div className="row__top">
                        <PhotoPick
                          src={photoUrl(x)}
                          label={x.name || 'produto'}
                          onPick={(photo) => patchShowcase(x.id, { photo })}
                          onClear={() => patchShowcase(x.id, { photo: '', photoId: null })}
                        />
                        <span className="input row__name">
                          <input aria-label="Nome do produto à venda" placeholder="Nome do produto" value={x.name} maxLength={60} onChange={(e) => patchShowcase(x.id, { name: e.target.value })} />
                        </span>
                        <Switch checked={x.visible} onChange={(v) => patchShowcase(x.id, { visible: v })} label="No site" />
                        <button type="button" className="chevbtn" aria-label={`Remover ${x.name || 'produto'}`} onClick={() => removeShowcase(x.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="row__grid">
                        <label className="mini-field">
                          <span>Preço</span>
                          <Money label="Preço" value={x.price} onChange={(v) => patchShowcase(x.id, { price: v })} />
                        </label>
                        <label className="mini-field mini-field--wide">
                          <span>Descrição curta</span>
                          <span className="input">
                            <input value={x.description} maxLength={120} placeholder="Ex.: hidrata e protege a cutícula" onChange={(e) => patchShowcase(x.id, { description: e.target.value })} />
                          </span>
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button variant="ghost" onClick={addShowcase} disabled={showcase.length >= 24} className="catalog__add">
                  <Plus size={16} aria-hidden="true" /> Novo produto à venda
                </Button>
              </div>
            )}

            {active === 'produtos' && (
              <div className="catalog">
                <p className="catalog__intro">
                  Aqui ficam seus gastos com material, só para calcular a margem de cada serviço. Isso não aparece no site. Para vender produtos, use a etapa{' '}
                  <strong>Produtos à venda</strong>.
                </p>
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
              <SiteFrame studio={draft} device="mobile" height={600} />
            )}
          </div>
        </Card>

        {isWide && (
          <Card variant="soft" className="studio__preview">
            <div className="studio__previewbar">
              <p className="studio__label">
                Prévia ao vivo
                {dirty && <span className="tag tag--aniversario">Não publicada</span>}
              </p>
              <DeviceToggle device={device} onChange={setDevice} />
            </div>
            <SiteFrame studio={draft} device={device} height="fill" />
          </Card>
        )}
      </div>
      {wizard && createPortal(wizardOverlay, document.body)}
    </div>
  )

  return full ? createPortal(root, document.body) : root
}

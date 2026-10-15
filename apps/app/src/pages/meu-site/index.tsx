import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, ExternalLink, Eye, Image as ImageIcon, MapPin, Maximize2, Palette, SlidersHorizontal, Type, Undo2, X } from 'lucide-react'
import { newId, useStudio, type ClientPlan, type Service, type ShowcaseItem, type SiteConfig } from '../../data/catalog'
import { blankPlan, blankShowcaseItem, patchById, removeById, type PublishState } from '../../domain/site'
import { isReservedSlug, siteHost } from '../../lib/slug'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useScrollLock } from '../../hooks/useScrollLock'
import SiteFrame, { DeviceToggle, type Device } from '../../components/SiteFrame'
import OnlineBookingChecklist from '../../components/OnlineBookingChecklist'
import { Button, Card, Em, PageHeader, Tabs, Tag } from '../../components/ui'
import { AppearanceFields } from './AppearanceFields'
import { IdentityFields } from './IdentityFields'
import { PreviewSheet } from './PreviewSheet'
import { PublishButton } from './PublishButton'
import { ServicesEditor } from './ServicesEditor'
import { ShowcaseEditor } from './ShowcaseEditor'
import { ContactFields, ShowFields, TextFields } from './SiteFields'
import './MeuSite.css'

type Tab = 'pagina' | 'servicos' | 'vitrine'

const TABS: { id: Tab; label: string }[] = [
  { id: 'pagina', label: 'Página' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'vitrine', label: 'Produtos' },
]

type Part = 'agendamento' | 'aparencia' | 'identidade' | 'textos' | 'contato' | 'mostrar'

/** partes da aba Página: uma aberta por vez, escolhida no trilho de ícones (o rótulo do trilho já diz o assunto) */
const PARTS: { id: Part; label: string; short: string; icon: ReactNode }[] = [
  { id: 'aparencia', label: 'Aparência: paleta, capa e fonte', short: 'Cores', icon: <Palette size={20} aria-hidden="true" /> },
  { id: 'identidade', label: 'Identidade: logo e foto de capa', short: 'Logo', icon: <ImageIcon size={20} aria-hidden="true" /> },
  { id: 'textos', label: 'Textos', short: 'Textos', icon: <Type size={20} aria-hidden="true" /> },
  { id: 'contato', label: 'Contato e endereço', short: 'Contato', icon: <MapPin size={20} aria-hidden="true" /> },
  { id: 'mostrar', label: 'O que mostrar: preços, equipe e sinal', short: 'Mostrar', icon: <SlidersHorizontal size={20} aria-hidden="true" /> },
  { id: 'agendamento', label: 'Agendamento pelo site', short: 'Agenda', icon: <CalendarCheck size={20} aria-hidden="true" /> },
]

/** Meu site: editor em etapas com a prévia ao vivo */
export default function MeuSite() {
  const { draft, setDraft, dirty, publish, discard, loading, error: loadError, isLive, publishedSlug } = useStudio()
  const isWide = useMediaQuery('(min-width: 1100px)')
  const [tab, setTab] = useState<Tab>('pagina')
  const [part, setPart] = useState<Part>('aparencia')
  const [justPublished, setJustPublished] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [fullPref, setFullPref] = useState(true)
  const [device, setDevice] = useState<Device>(isWide ? 'desktop' : 'mobile')
  const [previewOpen, setPreviewOpen] = useState(false)
  const navigate = useNavigate()
  const bodyRef = useRef<HTMLDivElement>(null)

  const { site, services, showcase, plans } = draft
  const slugReserved = isReservedSlug(site.slug)

  /** troca de aba e volta ao começo dela */
  const goTab = (id: Tab) => {
    setTab(id)
    bodyRef.current?.scrollTo({ top: 0 })
  }

  // alterações do rascunho
  const setSite = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => setDraft((d) => ({ ...d, site: { ...d.site, [key]: value } }))
  const patchService = (id: string, patch: Partial<Service>) => setDraft((d) => ({ ...d, services: patchById(d.services, id, patch) }))
  const patchPlan = (id: string, patch: Partial<ClientPlan>) => setDraft((d) => ({ ...d, plans: patchById(d.plans, id, patch) }))
  const addPlan = () => setDraft((d) => ({ ...d, plans: [...d.plans, blankPlan(newId('pl'))] }))
  const removePlan = (id: string) => setDraft((d) => ({ ...d, plans: removeById(d.plans, id) }))
  const patchShowcase = (id: string, patch: Partial<ShowcaseItem>) => setDraft((d) => ({ ...d, showcase: patchById(d.showcase, id, patch) }))
  const addShowcase = () => setDraft((d) => ({ ...d, showcase: [...d.showcase, blankShowcaseItem(newId('v'))] }))
  const removeShowcase = (id: string) => setDraft((d) => ({ ...d, showcase: removeById(d.showcase, id) }))

  /** publica e devolve se deu certo (o motivo do erro fica em `publishError`) */
  const runPublish = async () => {
    setPublishing(true)
    setPublishError(null)
    const problem = await publish()
    setPublishing(false)
    if (problem) setPublishError(problem)
    return !problem
  }
  const onPublish = async () => {
    if (!(await runPublish())) return
    setJustPublished(true)
    window.setTimeout(() => setJustPublished(false), 2500)
  }
  // tela cheia: sempre no celular (sem o menu do app); em telas largas é o padrão e o X minimiza só nesta visita
  const full = isWide ? fullPref : true
  useScrollLock(full)
  useEffect(() => {
    if (!full || !isWide) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullPref(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full, isWide])

  const publishState: PublishState = { isLive, dirty, justPublished, publishing, loading, reserved: slugReserved }
  const liveUrl = `https://${siteHost(publishedSlug)}`
  const closePreview = () => setPreviewOpen(false)

  // celular: uma barra só no topo (fechar, nome e endereço, prévia e publicar)
  const mobileBar = (
    <header className="sbar">
      <button type="button" className="sbar__icon" aria-label="Fechar o editor" onClick={() => navigate('/dashboard')}>
        <X size={20} aria-hidden="true" />
      </button>
      <div className="sbar__title">
        <h1>
          Meu <Em>site</Em>
        </h1>
        {isLive ? (
          <a href={liveUrl} target="_blank" rel="noreferrer">
            {siteHost(publishedSlug)}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        ) : (
          <span>{siteHost(site.slug)}</span>
        )}
      </div>
      {dirty && (
        <button type="button" className="sbar__icon sbar__icon--soft" aria-label="Descartar alterações" title="Descartar alterações" onClick={discard}>
          <Undo2 size={18} aria-hidden="true" />
        </button>
      )}
      <button type="button" className="sbar__icon sbar__icon--soft" aria-label="Ver a prévia" title="Ver a prévia" onClick={() => setPreviewOpen(true)}>
        <Eye size={18} aria-hidden="true" />
      </button>
      <PublishButton state={publishState} variant="compact" onClick={() => void onPublish()} />
    </header>
  )

  const root = (
    <div className={`page page--fit ${full ? 'sfull' : ''}`.trim()}>
      {isWide ? (
        <PageHeader
          title={
            <>
              Meu <Em>site</Em>
            </>
          }
          actions={
            <>
              {isLive ? (
                <a className="sitelink" href={liveUrl} target="_blank" rel="noreferrer">
                  <span>{siteHost(publishedSlug)}</span>
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              ) : (
                <span className="sitelink">
                  <span>{siteHost(site.slug)} · ainda não publicado</span>
                </span>
              )}
              <div className="bar__publish">
                {dirty && (
                  <Button variant="ghost" size="sm" onClick={discard}>
                    <Undo2 size={15} aria-hidden="true" /> Descartar
                  </Button>
                )}
                <PublishButton state={publishState} variant="header" onClick={() => void onPublish()} />
              </div>
              {full ? (
                <button type="button" className="sfull__x" aria-label="Minimizar" title="Minimizar (Esc)" onClick={() => setFullPref(false)}>
                  <X size={20} aria-hidden="true" />
                </button>
              ) : (
                <button type="button" className="sitelink" onClick={() => setFullPref(true)}>
                  <Maximize2 size={14} aria-hidden="true" />
                  <span>Tela cheia</span>
                </button>
              )}
            </>
          }
        />
      ) : (
        mobileBar
      )}

      {(loadError || publishError) && (
        <p className="field__hint" role="alert">
          {loadError ?? publishError}
        </p>
      )}

      <div className="studio">
        <Card className="studio__editor">
          <Tabs
            label="Partes do site"
            fill
            value={tab}
            onChange={goTab}
            items={TABS}
          />

          <div className="studio__body" id="studio-panel" role="tabpanel" ref={bodyRef}>
            {tab === 'pagina' && (
              <div className="parts">
                <section className="sect part" aria-label={PARTS.find((p) => p.id === part)?.label}>
                  <div className="form">
                    {part === 'agendamento' && <OnlineBookingChecklist bare whatsapp={site.whatsapp} online={site.onlineBooking} />}
                    {part === 'aparencia' && <AppearanceFields site={site} setSite={setSite} />}
                    {part === 'identidade' && <IdentityFields site={site} setSite={setSite} />}
                    {part === 'textos' && <TextFields site={site} setSite={setSite} />}
                    {part === 'contato' && <ContactFields site={site} setSite={setSite} slugReserved={slugReserved} />}
                    {part === 'mostrar' && <ShowFields site={site} setSite={setSite} />}
                  </div>
                </section>

                <nav className="rail" aria-label="Partes da página">
                  {PARTS.map((p) => (
                    <button key={p.id} type="button" className="rail__btn" aria-current={part === p.id ? 'true' : undefined} onClick={() => setPart(p.id)}>
                      {p.icon}
                      <span>{p.short}</span>
                    </button>
                  ))}
                </nav>
              </div>
            )}

            {tab === 'servicos' && (
              <ServicesEditor services={services} plans={plans} onPatchService={patchService} onPatchPlan={patchPlan} onAddPlan={addPlan} onRemovePlan={removePlan} />
            )}

            {tab === 'vitrine' && <ShowcaseEditor items={showcase} onPatch={patchShowcase} onAdd={addShowcase} onRemove={removeShowcase} />}

          </div>
        </Card>

        {isWide && (
          <Card variant="soft" className="studio__preview">
            <div className="studio__previewbar">
              <p className="studio__label">
                Prévia ao vivo
                {dirty && <Tag tone="aniversario">Não publicada</Tag>}
              </p>
              <DeviceToggle device={device} onChange={setDevice} />
            </div>
            <SiteFrame studio={draft} device={device} height="fill" />
          </Card>
        )}
      </div>

      {previewOpen && !isWide && <PreviewSheet studio={draft} host={siteHost(site.slug)} onClose={closePreview} />}
    </div>
  )

  return full ? createPortal(root, document.body) : root
}

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, ExternalLink, Maximize2, Undo2, X } from 'lucide-react'
import { newId, useStudio, type ClientPlan, type Service, type ShowcaseItem, type SiteConfig } from '../../data/catalog'
import { blankPlan, clampIndex, blankShowcaseItem, patchById, removeById, type PublishState } from '../../domain/site'
import { isReservedSlug, siteHost } from '../../lib/slug'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useScrollLock } from '../../hooks/useScrollLock'
import SiteFrame, { DeviceToggle, type Device } from '../../components/SiteFrame'
import OnlineBookingChecklist from '../../components/OnlineBookingChecklist'
import { Button, Card, Em, PageHeader, Section, Tag } from '../../components/ui'
import { AppearanceFields } from './AppearanceFields'
import { IdentityFields } from './IdentityFields'
import { PublishButton } from './PublishButton'
import { ServicesEditor } from './ServicesEditor'
import { ShowcaseEditor } from './ShowcaseEditor'
import { ContactFields, ShowFields, TextFields } from './SiteFields'
import './MeuSite.css'

type Tab = 'pagina' | 'servicos' | 'vitrine' | 'previa'

const TABS: { id: Tab; label: string; narrowOnly?: boolean }[] = [
  { id: 'pagina', label: 'Página' },
  { id: 'servicos', label: 'Serviços e planos' },
  { id: 'vitrine', label: 'Produtos à venda' },
  { id: 'previa', label: 'Prévia', narrowOnly: true },
]

/** Meu site: editor em etapas com a prévia ao vivo */
export default function MeuSite() {
  const { draft, setDraft, dirty, publish, discard, loading, error: loadError, isLive, publishedSlug } = useStudio()
  const isWide = useMediaQuery('(min-width: 1100px)')
  const [tab, setTab] = useState<Tab>('pagina')
  const [justPublished, setJustPublished] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [fullPref, setFullPref] = useState(true)
  const [device, setDevice] = useState<Device>(isWide ? 'desktop' : 'mobile')
  const bodyRef = useRef<HTMLDivElement>(null)

  const { site, services, showcase, plans } = draft
  const slugReserved = isReservedSlug(site.slug)

  const active: Tab = isWide && tab === 'previa' ? 'pagina' : tab
  const stepTabs = TABS.filter((t) => !t.narrowOnly || !isWide)
  const stepAt = clampIndex(stepTabs.findIndex((t) => t.id === active), stepTabs.length)
  /** troca de etapa e volta ao começo dela */
  const goTab = (i: number) => {
    const next = stepTabs[clampIndex(i, stepTabs.length)]
    if (!next) return
    setTab(next.id)
    bodyRef.current?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
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
  // tela cheia: padrão em telas largas; o X minimiza só nesta visita
  const full = fullPref && isWide
  useScrollLock(full)
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullPref(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  const publishState: PublishState = { isLive, dirty, justPublished, publishing, loading, reserved: slugReserved }
  const liveUrl = `https://${siteHost(publishedSlug)}`

  const root = (
    <div className={`page page--fit ${full ? 'sfull' : ''}`.trim()}>
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
            {isWide &&
              (full ? (
                <button type="button" className="sfull__x" aria-label="Minimizar" title="Minimizar (Esc)" onClick={() => setFullPref(false)}>
                  <X size={20} aria-hidden="true" />
                </button>
              ) : (
                <button type="button" className="sitelink" onClick={() => setFullPref(true)}>
                  <Maximize2 size={14} aria-hidden="true" />
                  <span>Tela cheia</span>
                </button>
              ))}
          </>
        }
      />

      {(dirty || !isLive) && (
        <div className="publishbar" role="region" aria-label="Publicar o site">
          {dirty && (
            <Button variant="light" size="sm" onClick={discard}>
              <Undo2 size={15} aria-hidden="true" /> Descartar
            </Button>
          )}
          <PublishButton state={publishState} variant="bar" onClick={() => void onPublish()} />
        </div>
      )}

      {(loadError || publishError) && (
        <p className="field__hint" role="alert">
          {loadError ?? publishError}
        </p>
      )}

      <div className="studio">
        <Card className="studio__editor">
          <div className="stepbar">
            <div className="stepbar__row">
              <button type="button" className="stepbar__arrow" aria-label="Etapa anterior" disabled={stepAt === 0} onClick={() => goTab(stepAt - 1)}>
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
              <div className="stepbar__bars" role="tablist" aria-label="Etapas do editor">
                {stepTabs.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={active === t.id}
                    aria-controls="studio-panel"
                    aria-label={t.label}
                    title={t.label}
                    className={i <= stepAt ? 'is-done' : undefined}
                    onClick={() => setTab(t.id)}
                  >
                    <i />
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="stepbar__arrow"
                aria-label="Próxima etapa"
                disabled={stepAt === stepTabs.length - 1}
                onClick={() => goTab(stepAt + 1)}
              >
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="stepbar__label">
              {stepTabs[stepAt].label}{' '}
              <span>
                · {stepAt + 1} de {stepTabs.length}
              </span>
            </p>
          </div>

          <div className="studio__body" id="studio-panel" role="tabpanel" aria-labelledby={`tab-${active}`} ref={bodyRef}>
            {active === 'pagina' && (
              <div className="sects">
                <details className="fold">
                  <summary>Agendamento pelo site</summary>
                  <OnlineBookingChecklist whatsapp={site.whatsapp} online={site.onlineBooking} />
                </details>

                <Section title="Aparência" hint="Paleta e fonte.">
                  <AppearanceFields site={site} setSite={setSite} />
                </Section>
                <Section title="Identidade" hint="Logo e foto de capa.">
                  <IdentityFields site={site} setSite={setSite} />
                </Section>
                <Section title="Textos" hint="O que a cliente lê primeiro.">
                  <TextFields site={site} setSite={setSite} />
                </Section>
                <Section title="Contato e endereço" hint="Como a cliente fala com você e encontra a página.">
                  <ContactFields site={site} setSite={setSite} slugReserved={slugReserved} />
                </Section>
                <Section title="O que mostrar" hint="Preços, equipe e sinal.">
                  <ShowFields site={site} setSite={setSite} />
                </Section>
              </div>
            )}

            {active === 'servicos' && (
              <ServicesEditor services={services} plans={plans} onPatchService={patchService} onPatchPlan={patchPlan} onAddPlan={addPlan} onRemovePlan={removePlan} />
            )}

            {active === 'vitrine' && <ShowcaseEditor items={showcase} onPatch={patchShowcase} onAdd={addShowcase} onRemove={removeShowcase} />}

            {active === 'previa' && <SiteFrame studio={draft} device="mobile" height={600} />}

            <div className="stepnav">
              {stepAt > 0 ? (
                <button type="button" className="stepnav__prev" onClick={() => goTab(stepAt - 1)}>
                  <ArrowLeft size={16} aria-hidden="true" /> {stepTabs[stepAt - 1].label}
                </button>
              ) : (
                <span />
              )}
              {stepAt < stepTabs.length - 1 && (
                <button type="button" className="stepnav__next" onClick={() => goTab(stepAt + 1)}>
                  Próximo: {stepTabs[stepAt + 1].label} <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
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
    </div>
  )

  return full ? createPortal(root, document.body) : root
}

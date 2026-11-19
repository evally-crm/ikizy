import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, CircleUserRound, Eye, LayoutList, Maximize2, PackagePlus, PanelRightClose, PanelRightOpen, Palette, Undo2, X } from 'lucide-react'
import { newId, useStudio, type ClientPlan, type Service, type ShowcaseItem, type SiteConfig } from '../../data/catalog'
import { useAgenda } from '../../data/AgendaProvider'
import { useBusiness, type ServiceInput } from '../../data/business'
import { blankPlan, blankShowcaseItem, firstOpenGuideStep, guideSteps, hoursSummary, patchById, quickSteps, removeById, type GuideStepId, type PublishState } from '../../domain/site'
import { isReservedSlug, siteHost } from '../../lib/slug'
import { dash } from '../../lib/routes'
import { accessState, isSiteOffline } from '../../lib/plans'
import { useSubscription } from '../../billing/SubscriptionProvider'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useScrollLock } from '../../hooks/useScrollLock'
import SiteFrame, { DeviceToggle, type Device } from '../../components/SiteFrame'
import { Button, Card, Em, PageHeader, Tag } from '../../components/ui'
import { AppearanceFields } from './AppearanceFields'
import { ExtrasEditor } from './ExtrasEditor'
import { CoverFields, IdentityFields } from './IdentityFields'
import { PreviewSheet } from './PreviewSheet'
import { PublishButton } from './PublishButton'
import { PublishedSummary } from './PublishedSummary'
import { SetupGuide } from './SetupGuide'
import { ServicesEditor, type SaveServiceResult } from './ServicesEditor'
import { BookingFields, TextFields } from './SiteFields'
import { SiteLinkButton } from './SiteLinkButton'
import './MeuSite.css'

type Part = 'perfil' | 'visual' | 'servicos' | 'extras' | 'agendamento'

/** um menu só: cada parte é um assunto, aberta uma por vez */
const PARTS: { id: Part; label: string; icon: ReactNode }[] = [
  { id: 'perfil', label: 'Perfil', icon: <CircleUserRound size={20} aria-hidden="true" /> },
  { id: 'visual', label: 'Visual', icon: <Palette size={20} aria-hidden="true" /> },
  { id: 'servicos', label: 'Serviços', icon: <LayoutList size={20} aria-hidden="true" /> },
  { id: 'extras', label: 'Extras', icon: <PackagePlus size={20} aria-hidden="true" /> },
  { id: 'agendamento', label: 'Agendar', icon: <CalendarCheck size={20} aria-hidden="true" /> },
]

const PART_KEY = 'ikizy:site:part'
/** a parte aberta por último nesta aba do navegador (ex.: volta em Serviços depois de ir à Agenda) */
const savedPart = (): Part => {
  try {
    const t = sessionStorage.getItem(PART_KEY)
    return PARTS.some((x) => x.id === t) ? (t as Part) : 'perfil'
  } catch {
    return 'perfil'
  }
}

/** cada passo do assistente abre a parte do editor onde ele se resolve */
const GUIDE_PART: Partial<Record<GuideStepId, Part>> = { perfil: 'perfil', servicos: 'servicos' }
const GUIDE_KEY = 'ikizy:site:guide-off'
const readGuideOff = () => {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1'
  } catch {
    return false
  }
}

/** prévia recolhida no computador: escolha guardada neste aparelho */
const PREVIEW_KEY = 'ikizy:site:preview-hidden'
const readPreviewHidden = () => {
  try {
    return localStorage.getItem(PREVIEW_KEY) === '1'
  } catch {
    return false
  }
}

/** Meu site: editor em etapas com a prévia ao vivo */
export default function MeuSite() {
  const { draft, setDraft, dirty, publish, discard, syncService, dropService, loading, error: loadError, isLive, publishedSlug } = useStudio()
  const { sub } = useSubscription()
  const biz = useBusiness()
  const isWide = useMediaQuery('(min-width: 1100px)')
  const [part, setPart] = useState<Part>(savedPart)
  const [justPublished, setJustPublished] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [fullPref, setFullPref] = useState(false)
  // a página é vista quase sempre no celular: a prévia abre nesse tamanho, estreita, e o editor fica com o resto
  const [device, setDevice] = useState<Device>('mobile')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHidden, setPreviewHidden] = useState(readPreviewHidden)
  const togglePreview = (hidden: boolean) => {
    setPreviewHidden(hidden)
    try {
      localStorage.setItem(PREVIEW_KEY, hidden ? '1' : '0')
    } catch {
      /* sem storage: vale só nesta visita */
    }
  }
  const [summary, setSummary] = useState<{ firstTime: boolean } | null>(null)
  const [guideIdx, setGuideIdx] = useState<number | null>(null)
  const [guideOff, setGuideOff] = useState(readGuideOff)
  const navigate = useNavigate()
  const bodyRef = useRef<HTMLDivElement>(null)

  const { site, services, showcase, plans } = draft
  const slugReserved = isReservedSlug(site.slug)

  /** troca de parte e volta ao começo dela */
  const goPart = (id: Part) => {
    setPart(id)
    try {
      sessionStorage.setItem(PART_KEY, id)
    } catch {
      /* sem storage: só não lembra a parte */
    }
    bodyRef.current?.scrollTo({ top: 0 })
  }

  // alterações do rascunho
  const setSite = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => setDraft((d) => ({ ...d, site: { ...d.site, [key]: value } }))
  const patchService = (id: string, patch: Partial<Service>) => setDraft((d) => ({ ...d, services: patchById(d.services, id, patch) }))
  // serviços: nome, preço e duração vão direto para o banco (valem para a agenda) e entram no rascunho já salvos
  const saveService = async (input: ServiceInput, id?: string): Promise<SaveServiceResult> => {
    const r = await biz.storeService(input, id)
    if (r.error === null) syncService(r.saved)
    return r
  }
  const removeService = async (id: string) => {
    const message = await biz.removeService(id)
    if (!message) dropService(id)
    return message
  }
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
    const wasLive = isLive
    if (!(await runPublish())) return
    setSummary({ firstTime: !wasLive })
    setJustPublished(true)
    window.setTimeout(() => setJustPublished(false), 2500)
  }
  // tela cheia: sempre no celular (sem o menu do app); em telas largas abre normal e o botão "Tela cheia" expande
  const full = isWide ? fullPref : true
  useScrollLock(full)
  useEffect(() => {
    if (!full || !isWide) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullPref(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full, isWide])

  // o horário do site sai da agenda: muda lá, o site acompanha (vai ao ar no próximo Publicar)
  const { workingHours } = useAgenda()
  const agendaHours = hoursSummary(Object.values(workingHours).flat())
  useEffect(() => {
    if (loading || loadError || !agendaHours || agendaHours === site.hours) return
    setDraft((d) => ({ ...d, site: { ...d.site, hours: agendaHours } }))
  }, [loading, loadError, agendaHours, site.hours, setDraft])

  // o que falta para o site ficar pronto: marca no menu (bolinha = falta, certo = feito) e o placar ao lado de Publicar
  const steps = quickSteps({ site, services, isLive, dirty })
  const isDone = (...ids: string[]) => ids.every((id) => steps.find((x) => x.id === id)?.done)
  const mark: Partial<Record<Part, boolean>> = {
    perfil: isDone('foto', 'textos'),
    servicos: isDone('precos'),
    agendamento: isDone('contato'),
  }
  const ready = steps.filter((x) => x.done).length

  // assistente da primeira vez: só enquanto o site nunca foi ao ar e a pessoa não fechou o guia
  const gsteps = guideSteps({ site, services, isLive, dirty, hasHours: Boolean(agendaHours) })
  const gidx = guideIdx ?? firstOpenGuideStep(gsteps)
  const showGuide = !loading && !loadError && !isLive &&!guideOff
  const goGuide = (i: number) => {
    setGuideIdx(i)
    // WhatsApp e horário são editados em Meu negócio e na agenda: o passo leva para lá
    if (gsteps[i].id === 'contato') {
      navigate(dash('/negocio'))
      return
    }
    const target = GUIDE_PART[gsteps[i].id]
    if (target) goPart(target)
  }
  const closeGuide = () => {
    setGuideOff(true)
    try {
      localStorage.setItem(GUIDE_KEY, '1')
    } catch {
      /* sem storage: fecha só nesta visita */
    }
  }

  const publishState: PublishState = { isLive, dirty, justPublished, publishing, loading, reserved: slugReserved }
  // acesso vencido há mais de 7 dias: o endereço mostra "temporariamente fora do ar" até a dona voltar a pagar
  // (só quando o acesso está vencido: a cortesia nunca vence, mesmo com access_until no passado)
  const siteOffline = !!sub && accessState(sub) === 'expired' && isSiteOffline(sub)
  const closePreview = () => setPreviewOpen(false)
  // endereço do site no topo (celular e computador): tocar abre copiar, abrir e mudar
  const siteLink = (className: string) => (
    <SiteLinkButton
      className={className}
      slug={site.slug}
      publishedSlug={publishedSlug}
      isLive={isLive}
      offline={siteOffline}
      reserved={slugReserved}
      onSlug={(v) => setSite('slug', v)}
    />
  )

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
        {siteLink('sbar__link')}
      </div>
      <button type="button" className="sbar__icon sbar__icon--soft sbar__icon--label" title="Ver a prévia" onClick={() => setPreviewOpen(true)}>
        <Eye size={18} aria-hidden="true" /> Prévia
      </button>
    </header>
  )

  // celular: descartar e publicar só aparecem embaixo depois da primeira alteração (ou enquanto o site não foi ao ar)
  // enquanto carrega ainda não se sabe se o site está no ar: a barra espera para não piscar
  const mobileDock = !loading && (dirty || !isLive || justPublished || publishing) && (
    <div className="sdock" role="region" aria-label="Publicação">
      <div className="sdock__bar">
        {dirty ? (
          <button type="button" className="sdock__undo" onClick={discard}>
            <Undo2 size={18} aria-hidden="true" /> Descartar
          </button>
        ) : (
          <span className="sdock__status">{justPublished ? 'Site no ar' : 'Ainda não publicado'}</span>
        )}
      </div>
      <PublishButton state={publishState} variant="compact" onClick={() => void onPublish()} />
    </div>
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
              {siteLink('sitelink')}
              <div className="bar__publish">
                {!loading && ready < steps.length && (
                  <span className="readiness" title={steps.filter((x) => !x.done).map((x) => x.label).join(' · ')}>
                    {ready} de {steps.length} prontos
                  </span>
                )}
                {dirty && (
                  <Button variant="ghost" size="sm" onClick={discard}>
                    <Undo2 size={15} aria-hidden="true" /> Descartar
                  </Button>
                )}
                <PublishButton state={publishState} variant="header" onClick={() => void onPublish()} />
              </div>
              {full ? (
                <Button variant="ghost" size="sm" icon aria-label="Minimizar" title="Minimizar (Esc)" onClick={() => setFullPref(false)}>
                  <X size={18} aria-hidden="true" />
                </Button>
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
        <>
          {mobileBar}
          {mobileDock}
        </>
      )}

      {(loadError || publishError) && (
        <p className="field__hint" role="alert">
          {loadError ?? publishError}
        </p>
      )}

      <div className={`studio ${!isWide ? '' : previewHidden ? 'studio--nopreview' : device === 'desktop' ? 'studio--widepreview' : ''}`.trim()}>
        <Card className="studio__editor">
          {showGuide && <SetupGuide steps={gsteps} index={gidx} publishing={publishing} onGo={goGuide} onPublish={() => void onPublish()} onSkip={closeGuide} />}
          <div className="studio__body parts" ref={bodyRef}>
            <section className="sect part" aria-label={PARTS.find((p) => p.id === part)?.label}>
              <div className="form">
                {part === 'perfil' && (
                  <>
                    <IdentityFields site={site} setSite={setSite} />
                    <TextFields site={site} setSite={setSite} categories={[...new Set(services.map((x) => x.category))]} />
                  </>
                )}
                {part === 'visual' && (
                  <>
                    <CoverFields site={site} setSite={setSite} />
                    <AppearanceFields site={site} setSite={setSite} />
                  </>
                )}
                {part === 'servicos' && (
                  <ServicesEditor
                    services={services}
                    products={draft.products}
                    onPatchService={patchService}
                    onSaveService={saveService}
                    onRemoveService={removeService}
                  />
                )}
                {part === 'extras' && (
                  <ExtrasEditor
                    plans={plans}
                    showcase={showcase}
                    onPatchPlan={patchPlan}
                    onAddPlan={addPlan}
                    onRemovePlan={removePlan}
                    onPatchShowcase={patchShowcase}
                    onAddShowcase={addShowcase}
                    onRemoveShowcase={removeShowcase}
                  />
                )}
                {part === 'agendamento' && <BookingFields site={site} setSite={setSite} />}
              </div>
            </section>

            <nav className="rail" aria-label="Partes do site">
              {PARTS.map((p) => {
                const done = mark[p.id]
                const state = done === undefined || loading ? '' : done ? ', pronto' : ', falta preencher'
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="rail__btn"
                    aria-current={part === p.id ? 'true' : undefined}
                    aria-label={`${p.label}${state}`}
                    title={p.label}
                    onClick={() => goPart(p.id)}
                  >
                    {p.icon}
                    <span className="rail__label" aria-hidden="true">
                      {p.label}
                    </span>
                    {state && <span className={`rail__mark ${done ? 'is-done' : ''}`.trim()} aria-hidden="true" />}
                  </button>
                )
              })}
            </nav>
          </div>
        </Card>

        {isWide && previewHidden && (
          <button type="button" className="studio__peek" onClick={() => togglePreview(false)} aria-label="Ver prévia" title="Ver prévia">
            <PanelRightOpen size={18} aria-hidden="true" />
            <span>Ver prévia</span>
          </button>
        )}
        {isWide && !previewHidden && (
          <Card variant="soft" className="studio__preview">
            <div className="studio__previewbar">
              <p className="studio__label">
                Prévia
                {dirty && <Tag tone="aconfirmar">Não publicada</Tag>}
              </p>
              <button type="button" className="chevbtn" aria-label="Esconder prévia" title="Esconder prévia" onClick={() => togglePreview(true)}>
                <PanelRightClose size={16} aria-hidden="true" />
              </button>
            </div>
            <DeviceToggle device={device} onChange={setDevice} />
            <SiteFrame studio={draft} device={device} height="fill" />
          </Card>
        )}
      </div>

      {summary && (
        <PublishedSummary
          site={site}
          services={services}
          host={siteHost(publishedSlug)}
          firstTime={summary.firstTime}
          onClose={() => setSummary(null)}
          onFixBooking={() => {
            setSummary(null)
            goPart('agendamento')
          }}
        />
      )}

      {previewOpen && !isWide && <PreviewSheet studio={draft} host={siteHost(site.slug)} onClose={closePreview} />}
    </div>
  )

  return full ? createPortal(root, document.body) : root
}

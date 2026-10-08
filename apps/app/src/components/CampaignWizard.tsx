import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { format, addDays } from 'date-fns'
import { ArrowLeft, ArrowRight, Check, Clock, Search, ShieldAlert, X } from 'lucide-react'
import { TAG_LABEL, clientTags, type Client, type ClientTag } from '../data/clients'
import {
  EXCLUSION_LABEL,
  FIELD_LABEL,
  FREE_CAMPAIGNS_PER_MONTH,
  MAX_RECIPIENTS,
  MIN_RECIPIENTS,
  OFFER_TEMPLATES,
  SEND_HOURS,
  TEMPLATE_IDS,
  estimateMinutes,
  renderOffer,
  toWhatsappNumber,
  validateOffer,
  type ExclusionReason,
  type FieldId,
  type TemplateId,
} from '../lib/campaigns'
import { createCampaign, type Overview } from '../lib/whatsappApi'
import { Em } from './ui'

type Step = 'clientes' | 'oferta' | 'revisar'
const STEPS: Step[] = ['clientes', 'oferta', 'revisar']

type Filter = 'todas' | ClientTag
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'vip', label: TAG_LABEL.vip },
  { id: 'nova', label: 'Novas' },
  { id: 'sumida', label: 'Sumidas' },
  { id: 'aniversario', label: TAG_LABEL.aniversario },
]

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const TITLES: Record<Step, ReactNode> = {
  clientes: (
    <>
      Para quem vai a <Em>oferta</Em>?
    </>
  ),
  oferta: (
    <>
      Qual é a <Em>oferta</Em>?
    </>
  ),
  revisar: (
    <>
      Tudo certo para <Em>enviar</Em>?
    </>
  ),
}

/** nova campanha em 3 passos: clientes → oferta (modelo + campos) → revisar e enviar */
export function CampaignWizard({
  clients,
  overview,
  salonName,
  siteUrl,
  onClose,
  onCreated,
}: {
  clients: Client[]
  overview: Overview
  salonName: string
  siteUrl?: string
  onClose: () => void
  onCreated: (total: number) => void
}) {
  const today = useMemo(() => new Date(), [])
  const [step, setStep] = useState<Step>('clientes')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('todas')
  const [template, setTemplate] = useState<TemplateId>('promocao')
  const [values, setValues] = useState<Record<FieldId, string>>({
    servico: '',
    preco: '',
    desconto: '',
    validade: format(addDays(today, 7), 'yyyy-MM-dd'),
    extra: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // trava a rolagem da página e fecha no Esc
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, busy])

  // por que uma cliente não pode entrar agora
  const reasons = useMemo(() => {
    const out = new Map<string, ExclusionReason>()
    const optedOut = new Set(overview.exclusions.optedOut)
    const received = new Set(overview.exclusions.receivedThisMonth)
    for (const c of clients) {
      if (!toWhatsappNumber(c.phone)) out.set(c.id, 'sem_whatsapp')
      else if (optedOut.has(c.id)) out.set(c.id, 'saiu')
      else if (received.has(c.id)) out.set(c.id, 'ja_recebeu')
    }
    return out
  }, [clients, overview.exclusions])

  const visible = useMemo(() => {
    const q = normalize(query.trim())
    return clients
      .filter((c) => filter === 'todas' || clientTags(c, today).includes(filter))
      .filter((c) => !q || normalize(c.name).includes(q))
      .sort((a, b) => Number(reasons.has(a.id)) - Number(reasons.has(b.id)) || a.name.localeCompare(b.name, 'pt-BR'))
  }, [clients, query, filter, today, reasons])

  const selectable = visible.filter((c) => !reasons.has(c.id))
  const allVisibleSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.id))
  const count = selected.size
  const full = count >= MAX_RECIPIENTS

  const toggle = (id: string) => {
    setError(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_RECIPIENTS) next.add(id)
      return next
    })
  }

  const toggleVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) selectable.forEach((c) => next.delete(c.id))
      else for (const c of selectable) if (next.size < MAX_RECIPIENTS) next.add(c.id)
      return next
    })
  }

  const tpl = OFFER_TEMPLATES[template]
  const fieldIds = [...tpl.required, ...tpl.optional]
  const offer = validateOffer(template, values)
  const sampleName = clients.find((c) => selected.has(c.id))?.name ?? 'Maria'
  const preview = renderOffer(template, offer.fields, { clientName: sampleName, salonName, siteUrl })

  const freeLeft = Math.max(0, FREE_CAMPAIGNS_PER_MONTH - overview.quota.usedFree)
  const index = STEPS.indexOf(step)
  const canContinue = step === 'clientes' ? count >= MIN_RECIPIENTS : step === 'oferta' ? !offer.error : !busy

  async function next() {
    setError(null)
    if (step === 'clientes') {
      if (count < MIN_RECIPIENTS) return setError(`Escolha pelo menos ${MIN_RECIPIENTS} clientes.`)
      return setStep('oferta')
    }
    if (step === 'oferta') {
      if (offer.error) return setError(offer.error)
      return setStep('revisar')
    }
    setBusy(true)
    try {
      const out = await createCampaign(template, offer.fields, [...selected])
      onCreated(out.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar a campanha agora.')
      setBusy(false)
    }
  }

  const back = () => {
    setError(null)
    if (index > 0) setStep(STEPS[index - 1])
  }

  const hours = estimateMinutes(count) / 60

  return createPortal(
    <div className="campwiz" role="dialog" aria-modal="true" aria-label="Nova campanha de oferta">
      <div className="campwiz__inner">
        <div className="wiz__bar">
          <button type="button" className="wiz__back" onClick={back} disabled={index === 0 || busy} aria-label="Voltar">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div className="wiz__progress" role="progressbar" aria-label="Progresso" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={index + 1}>
            {STEPS.map((id, i) => (
              <span key={id} className={i <= index ? 'is-done' : undefined} />
            ))}
          </div>
          <button type="button" className="wiz__back campwiz__x" onClick={onClose} disabled={busy} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="wiz__eyebrow">Nova campanha no WhatsApp</p>
        <h1 className="auth__title">{TITLES[step]}</h1>

        {step === 'clientes' && (
          <>
            <p className="card__sub">
              De {MIN_RECIPIENTS} a {MAX_RECIPIENTS} clientes. Cada cliente recebe no máximo uma oferta por mês.
            </p>
            <label className="search campwiz__search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Buscar cliente</span>
              <input type="search" placeholder="Buscar por nome" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            </label>
            <div className="chips chips--scroll" role="group" aria-label="Filtrar clientes">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="campwiz__selbar">
              <button type="button" className="textlink" onClick={toggleVisible} disabled={selectable.length === 0}>
                {allVisibleSelected ? 'Desmarcar estas' : `Marcar todas (${Math.min(selectable.length, MAX_RECIPIENTS)})`}
              </button>
              {count > 0 && (
                <button type="button" className="textlink" onClick={() => setSelected(new Set())}>
                  Limpar
                </button>
              )}
            </div>
            <ul className="campwiz__list">
              {visible.map((c) => {
                const reason = reasons.get(c.id)
                const on = selected.has(c.id)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="campwiz__row"
                      aria-pressed={on}
                      disabled={Boolean(reason) || (!on && full)}
                      onClick={() => toggle(c.id)}
                    >
                      <span className="campwiz__check" aria-hidden="true">
                        {on && <Check size={14} />}
                      </span>
                      <span className="campwiz__name">{c.name}</span>
                      {reason ? <span className="campwiz__why">{EXCLUSION_LABEL[reason]}</span> : <span className="campwiz__phone">{c.phone}</span>}
                    </button>
                  </li>
                )
              })}
              {visible.length === 0 && <li className="crm__empty">Nenhuma cliente encontrada.</li>}
            </ul>
          </>
        )}

        {step === 'oferta' && (
          <>
            <div className="wiz__options" role="radiogroup" aria-label="Modelo da mensagem">
              {TEMPLATE_IDS.map((id) => (
                <button key={id} type="button" role="radio" className="wiz__opt" aria-pressed={template === id} aria-checked={template === id} onClick={() => setTemplate(id)}>
                  {OFFER_TEMPLATES[id].label}
                </button>
              ))}
            </div>
            <p className="card__sub">{tpl.hint}.</p>
            <div className="campwiz__offer">
              <div className="form">
                {fieldIds.map((id) => (
                  <label key={id} className="field">
                    <span className="field__label">{FIELD_LABEL[id]}</span>
                    <span className="input">
                      {id === 'preco' && <span className="wiz__cur">R$</span>}
                      <input
                        type={id === 'validade' ? 'date' : 'text'}
                        inputMode={id === 'preco' || id === 'desconto' ? 'decimal' : undefined}
                        min={id === 'validade' ? format(today, 'yyyy-MM-dd') : undefined}
                        maxLength={id === 'extra' ? 160 : id === 'servico' ? 60 : 10}
                        placeholder={id === 'servico' ? 'Ex.: Esmaltação em gel' : id === 'preco' ? '89,90' : id === 'desconto' ? '20' : id === 'extra' ? 'Ex.: Vagas limitadas!' : undefined}
                        value={values[id]}
                        onChange={(e) => {
                          setError(null)
                          const v = id === 'preco' ? e.target.value.replace(/[^\d,.]/g, '') : id === 'desconto' ? e.target.value.replace(/\D/g, '') : e.target.value
                          setValues({ ...values, [id]: v })
                        }}
                      />
                      {id === 'desconto' && <span className="wiz__cur">%</span>}
                    </span>
                  </label>
                ))}
              </div>
              <figure className="campwiz__preview">
                <figcaption>Como {sampleName.split(' ')[0]} vai receber</figcaption>
                <p className="campwiz__bubble">{preview}</p>
              </figure>
            </div>
          </>
        )}

        {step === 'revisar' && (
          <div className="campwiz__review">
            <dl className="campwiz__summary">
              <div>
                <dt>Clientes</dt>
                <dd>{count}</dd>
              </div>
              <div>
                <dt>Modelo</dt>
                <dd>{tpl.label}</dd>
              </div>
              <div>
                <dt>Conta como</dt>
                <dd>{freeLeft > 0 ? 'Campanha grátis do mês' : `Campanha extra (você tem ${overview.quota.credits})`}</dd>
              </div>
            </dl>
            <p className="campwiz__bubble">{preview}</p>
            <p className="campwiz__note">
              <Clock size={16} aria-hidden="true" />
              <span>
                As mensagens saem aos poucos, uma a cada 1 ou 2 minutos, só das {SEND_HOURS.from}h às {SEND_HOURS.to}h. Para {count} clientes, leva cerca de{' '}
                {hours < 1 ? `${estimateMinutes(count)} minutos` : `${Math.ceil(hours)} ${Math.ceil(hours) === 1 ? 'hora' : 'horas'}`} de envio.
              </span>
            </p>
            <p className="campwiz__note campwiz__note--warn">
              <ShieldAlert size={16} aria-hidden="true" />
              <span>
                Envie só para quem conhece o salão e aceita receber novidades. Muitas pessoas bloqueando ou denunciando pode fazer o WhatsApp suspender o número. Quem responder
                SAIR não recebe mais ofertas.
              </span>
            </p>
          </div>
        )}

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        <div className="auth__foot campwiz__foot">
          <p className="campwiz__count">
            {step === 'clientes' ? (
              <>
                <strong>{count}</strong> de {MAX_RECIPIENTS}
                {count < MIN_RECIPIENTS && <small> · faltam {MIN_RECIPIENTS - count}</small>}
                {full && <small> · limite atingido</small>}
              </>
            ) : (
              <>
                <strong>{count}</strong> clientes
              </>
            )}
          </p>
          <button
            type="button"
            className="auth__go"
            disabled={!canContinue}
            onClick={() => void next()}
            aria-label={step === 'revisar' ? (busy ? 'Enviando…' : 'Enviar campanha') : 'Continuar'}
            title={step === 'revisar' ? 'Enviar campanha' : 'Continuar'}
          >
            {step === 'revisar' ? <Check size={22} aria-hidden="true" /> : <ArrowRight size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Check } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { SubscriptionProvider, useSubscription } from '../../billing/SubscriptionProvider'
import { clearOnboardingDraft, readOnboardingDraft } from '../../data/onboarding'
import { planFit, suggestedPlan } from '../../domain/onboarding'
import { BillingError, chooseTrialPlan, startCheckout } from '../../lib/billingApi'
import { formatBRL } from '../../lib/format'
import { CHOSEN_PLAN_KEY, PLAN_IDS, PLANS, TRIAL_DAYS, type PlanId } from '../../lib/plans'
import { ROUTES } from '../../lib/routes'
import { noSalonPath } from '../../lib/pendingInvite'
import { Next } from './Ask'
import { DraftPreview } from './AppPreview'
import { OnboardingShell, Question } from './OnboardingShell'
import './Plano.css'

const longDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })

/** quanto tempo esperar o webhook do Stripe confirmar o cartão antes de pedir para tentar de novo */
const CONFIRM_TRIES = 12
const CONFIRM_EVERY_MS = 2500

function sitePlan(): string | null {
  try {
    return localStorage.getItem(CHOSEN_PLAN_KEY)
  } catch {
    return null
  }
}

/** acabou o cadastro: o rascunho e o plano vindo do site não servem mais */
function clearSignupLeftovers() {
  clearOnboardingDraft()
  try {
    localStorage.removeItem(CHOSEN_PLAN_KEY)
  } catch {
    // nada a limpar
  }
}

/**
 * /cadastro/plano: último passo, depois de ver a agenda pronta. Três planos lado a lado, todos com
 * 30 dias grátis sem cartão; quem preferir já cadastra o cartão no Stripe (a 1ª cobrança vem no fim do teste).
 */
export default function Plano() {
  return (
    <SubscriptionProvider>
      <PlanStep />
    </SubscriptionProvider>
  )
}

function PlanStep() {
  const { status, salon } = useAuth()
  const { sub, loading, refresh } = useSubscription()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returned = params.get('retorno')
  const [draft] = useState(readOnboardingDraft)
  const [picked, setPicked] = useState<PlanId | null>(null)
  const [busy, setBusy] = useState<'trial' | 'card' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(returned === 'ok')

  // voltando do Stripe: o webhook leva alguns segundos para gravar a assinatura
  useEffect(() => {
    if (returned !== 'ok') return
    let tries = 0
    const timer = window.setInterval(() => {
      void refresh()
      if (++tries >= CONFIRM_TRIES) {
        window.clearInterval(timer)
        setWaiting(false)
      }
    }, CONFIRM_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [returned, refresh])

  // só a dona escolhe o plano; sem assinatura legível (cobrança desativada) não há o que escolher
  const done = status === 'ready' && !loading && (!sub || sub.planChosen || salon?.role !== 'owner')
  useEffect(() => {
    if (done) clearSignupLeftovers()
  }, [done])

  if (status === 'signed-out') return <Navigate to={ROUTES.login} replace />
  if (status === 'no-salon') return <Navigate to={noSalonPath()} replace />
  if (done) return <Navigate to={ROUTES.dashboard} replace />

  const demo = status === 'demo'
  const ownerName = draft.ownerName
  const backdrop = <DraftPreview draft={draft} ownerName={ownerName} phase="ready" />

  if (!demo && (status === 'loading' || loading || waiting)) {
    return (
      <OnboardingShell backdrop={backdrop}>
        <Question title={waiting ? 'Confirmando seu cartão…' : 'Carregando…'} subtitle={waiting ? 'Leva só alguns segundos.' : undefined}>
          <span className="sr-only" role="status">
            {waiting ? 'Confirmando seu cartão…' : 'Carregando…'}
          </span>
        </Question>
      </OnboardingShell>
    )
  }

  // a resposta da equipe manda; sem ela (cadastro antigo), o plano em que o teste começou
  const plan = picked ?? (draft.team ? suggestedPlan(draft.team, sitePlan()) : (sub?.plan ?? 'solo'))
  const suggested = draft.team ? suggestedPlan(draft.team, sitePlan()) : null
  const trialEnd = sub?.trialEndsAt ?? sub?.accessUntil ?? null
  const fit = planFit(plan, draft.team)

  const startTrial = async () => {
    setBusy('trial')
    setError(null)
    try {
      await chooseTrialPlan(plan)
      if (demo) {
        clearSignupLeftovers()
        return navigate(ROUTES.dashboard)
      }
      await refresh()
    } catch (e) {
      setError(e instanceof BillingError ? e.message : 'Não foi possível salvar o plano agora.')
      setBusy(null)
    }
  }

  const withCard = async () => {
    setBusy('card')
    setError(null)
    try {
      await startCheckout(plan, 'card', 1, 'onboarding')
    } catch (e) {
      setError(e instanceof BillingError ? e.message : 'Não foi possível abrir o pagamento agora.')
      setBusy(null)
    }
  }

  return (
    <OnboardingShell backdrop={backdrop} size="wide">
      <Question
        title="Escolha seu plano"
        subtitle={`${TRIAL_DAYS} dias grátis em qualquer plano, sem cartão${trialEnd ? `, até ${longDate.format(trialEnd)}` : ''}. Você troca de plano quando quiser.`}
      >
        {returned === 'cancelado' && <p className="onb-plans__alert">Pagamento cancelado. Nada foi cobrado; escolha de novo quando quiser.</p>}
        {returned === 'ok' && !waiting && (
          <p className="onb-plans__alert">Ainda não recebemos a confirmação do cartão. Aguarde um instante e recarregue, ou tente de novo.</p>
        )}

        <form
          className="onb__form"
          onSubmit={(e) => {
            e.preventDefault()
            void startTrial()
          }}
        >
          <div className="onb-plans" role="radiogroup" aria-label="Planos">
            {PLAN_IDS.map((id) => {
              const p = PLANS[id]
              const f = planFit(id, draft.team)
              return (
                <button key={id} type="button" role="radio" aria-checked={plan === id} className="onb-plans__card" onClick={() => setPicked(id)}>
                  {id === suggested && <span className="onb-plans__tag">Sugerido para você</span>}
                  <span className="onb-plans__name">{p.name}</span>
                  <span className="onb-plans__aud">{p.audience}</span>
                  <span className="onb-plans__price">
                    {formatBRL(p.cents / 100)}
                    <small>/mês</small>
                  </span>
                  {f && (
                    <span className={f.fits ? 'onb-plans__fit' : 'onb-plans__fit onb-plans__fit--no'}>
                      {f.fits ? <Check size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
                      {f.text}
                    </span>
                  )}
                  <span className="onb-plans__feats">
                    {p.features.map((x) => (
                      <span key={x}>
                        <Check size={14} aria-hidden="true" /> {x}
                      </span>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>

          {fit && !fit.fits && <p className="onb-plans__warn">O Solo é para quem atende sozinha. Com equipe, o Studio combina mais.</p>}
          <Next label={busy === 'trial' ? 'Começando…' : `Começar ${TRIAL_DAYS} dias grátis`} busy={busy !== null} sticky />
          <p className="onb-plans__note">
            Nada é cobrado agora. No fim do teste você paga por Pix ou cartão, {formatBRL(PLANS[plan].cents / 100)} por mês.
          </p>
          <button type="button" className="onb-plans__card-link" disabled={busy !== null} onClick={() => void withCard()}>
            {busy === 'card' ? 'Abrindo o pagamento…' : 'Prefiro já cadastrar o cartão'}
          </button>
          {error && (
            <p className="onb__error" role="alert">
              {error}
            </p>
          )}
        </form>
      </Question>
    </OnboardingShell>
  )
}

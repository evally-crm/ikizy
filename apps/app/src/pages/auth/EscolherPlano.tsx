import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Check, CreditCard, QrCode } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { SubscriptionProvider, useSubscription } from '../../billing/SubscriptionProvider'
import { Em } from '../../components/ui'
import { BillingError, chooseTrialPlan, startCheckout } from '../../lib/billingApi'
import { formatBRL } from '../../lib/format'
import { PLAN_IDS, PLANS, TRIAL_DAYS, type PlanId } from '../../lib/plans'
import { ROUTES } from '../../lib/routes'
import { AuthLayout, FormMessages } from './AuthLayout'

const longDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })

/** quanto tempo esperar o webhook do Stripe confirmar o cartão antes de pedir para tentar de novo */
const CONFIRM_TRIES = 12
const CONFIRM_EVERY_MS = 2500

/** /cadastro/plano: último passo do cadastro, depois do questionário. Escolhe o plano e como pagar no fim do teste. */
export default function EscolherPlano() {
  return (
    <SubscriptionProvider>
      <PlanStep />
    </SubscriptionProvider>
  )
}

function PlanStep() {
  const { status, salon, signOut } = useAuth()
  const { sub, loading, refresh } = useSubscription()
  const [params] = useSearchParams()
  const returned = params.get('retorno')
  const [plan, setPlan] = useState<PlanId>('solo')
  const [busy, setBusy] = useState<'card' | 'pix' | null>(null)
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

  if (status === 'signed-out') return <Navigate to={ROUTES.login} replace />
  if (status === 'no-salon') return <Navigate to={ROUTES.createSalon} replace />
  if (status === 'demo') return <Navigate to={ROUTES.dashboard} replace />
  // só a dona escolhe o plano; sem assinatura legível (cobrança desativada) não há o que escolher
  const done = status === 'ready' && !loading && (!sub || sub.planChosen || salon?.role !== 'owner')
  if (done) return <Navigate to={ROUTES.dashboard} replace />

  if (status === 'loading' || loading || waiting) {
    return (
      <div className="splash" role="status" aria-live="polite">
        <span className="splash__logo">
          IKIZY<span className="logo__dot">.</span>
        </span>
        <span className="sr-only">{waiting ? 'Confirmando seu cartão…' : 'Carregando…'}</span>
        {waiting && <p className="splash__text">Confirmando seu cartão…</p>}
      </div>
    )
  }

  const trialEnd = sub?.trialEndsAt ?? sub?.accessUntil ?? null
  const chosen = PLANS[plan]

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

  const withPix = async () => {
    setBusy('pix')
    setError(null)
    try {
      await chooseTrialPlan(plan)
      await refresh()
    } catch (e) {
      setError(e instanceof BillingError ? e.message : 'Não foi possível salvar o plano agora.')
      setBusy(null)
    }
  }

  return (
    <AuthLayout>
      <div className="wiz">
        <p className="wiz__eyebrow">Último passo</p>
        <h1 className="auth__title">
          <Em>Escolha</Em> o seu plano
        </h1>
        <p className="card__sub">
          Os primeiros {TRIAL_DAYS} dias são grátis em qualquer plano
          {trialEnd ? `, até ${longDate.format(trialEnd)}` : ''}. Você pode trocar de plano depois.
        </p>

        {returned === 'cancelado' && <p className="alert">Pagamento cancelado. Nada foi cobrado; escolha de novo quando quiser.</p>}
        {returned === 'ok' && !waiting && (
          <p className="alert">Ainda não recebemos a confirmação do cartão. Aguarde um instante e recarregue, ou tente de novo.</p>
        )}

        <div className="planpick" role="radiogroup" aria-label="Planos">
          {PLAN_IDS.map((id) => {
            const p = PLANS[id]
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={plan === id}
                className="planpick__item"
                onClick={() => setPlan(id)}
              >
                <span className="planpick__head">
                  <span className="planpick__name">{p.name}</span>
                  <span className="planpick__price">
                    {formatBRL(p.cents / 100)}
                    <small>/mês</small>
                  </span>
                </span>
                <span className="planpick__aud">{p.audience}</span>
                <span className="planpick__feats">
                  {p.features.map((f) => (
                    <span key={f}>
                      <Check size={14} aria-hidden="true" /> {f}
                    </span>
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        <p className="planpick__how">Como você quer pagar quando o teste acabar?</p>
        <div className="planpick__pay">
          <button type="button" className="planpick__method" disabled={busy !== null} onClick={() => void withCard()}>
            <CreditCard size={20} aria-hidden="true" />
            <span>
              <strong>{busy === 'card' ? 'Abrindo…' : 'Cartão de crédito'}</strong>
              <small>
                Nada é cobrado agora. A 1ª cobrança de {formatBRL(chosen.cents / 100)} vem
                {trialEnd ? ` em ${longDate.format(trialEnd)}` : ' no fim do teste'} e renova todo mês.
              </small>
            </span>
          </button>
          <button type="button" className="planpick__method" disabled={busy !== null} onClick={() => void withPix()}>
            <QrCode size={20} aria-hidden="true" />
            <span>
              <strong>{busy === 'pix' ? 'Salvando…' : 'Pix, sem cartão'}</strong>
              <small>Teste sem cadastrar cartão. Antes do fim do teste, você paga por Pix (1 ou 3 meses).</small>
            </span>
          </button>
        </div>

        <FormMessages error={error} />

        <div className="auth__foot">
          <button type="button" className="textlink" onClick={() => void signOut()}>
            Sair desta conta
          </button>
        </div>
      </div>
    </AuthLayout>
  )
}

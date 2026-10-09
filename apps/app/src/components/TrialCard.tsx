import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useSubscription } from '../billing/SubscriptionProvider'
import { dash } from '../lib/routes'
import { daysLeft, PLANS, TRIAL_DAYS } from '../lib/plans'
import { Em } from './ui'

const longDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })

/** contagem do teste grátis no Início: aparece durante todo o teste (sem cartão cadastrado) */
export default function TrialCard() {
  const { sub, state, loading } = useSubscription()
  if (loading || !sub || state !== 'trial') return null

  const left = daysLeft(sub.accessUntil)
  const used = Math.min(Math.max(TRIAL_DAYS - left, 0), TRIAL_DAYS)
  const urgent = left <= 7

  return (
    <section className={`trialcard ${urgent ? 'trialcard--urgent' : ''}`} aria-labelledby="trialcard-title">
      <div className="trialcard__info">
        <p className="trialcard__eyebrow">
          <Sparkles size={14} aria-hidden="true" /> Teste grátis · plano {PLANS[sub.plan].name}
        </p>
        <h2 id="trialcard-title" className="trialcard__title">
          {left <= 1 ? (
            <>
              Seu teste termina <Em>hoje</Em>
            </>
          ) : (
            <>
              Faltam <Em>{left} dias</Em> de teste
            </>
          )}
        </h2>
        <p className="trialcard__sub">
          Vai até {longDate.format(sub.accessUntil)}. Sem cartão cadastrado: nada é cobrado sozinho.
        </p>
      </div>

      <div
        className="trialcard__meter"
        role="progressbar"
        aria-label="Dias de teste usados"
        aria-valuemin={0}
        aria-valuemax={TRIAL_DAYS}
        aria-valuenow={used}
        aria-valuetext={`${used} de ${TRIAL_DAYS} dias usados`}
      >
        {Array.from({ length: TRIAL_DAYS }, (_, i) => (
          <span key={i} className={i < used ? 'is-used' : undefined} />
        ))}
      </div>

      <Link to={dash('/assinatura')} className="trialcard__cta">
        {urgent ? 'Assinar agora' : 'Ver planos'}
        <span className="trialcard__arrow">
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </Link>
    </section>
  )
}

import { Link } from 'react-router-dom'
import { useSubscription } from '../billing/SubscriptionProvider'
import { formatBRL } from '../lib/format'
import { PLANS, TRIAL_DAYS, daysLeft, isCardTrial, periodEnd } from '../lib/plans'
import { dash } from '../lib/routes'

const longDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })

/** contagem do teste grátis no dashboard: quantos dias faltam e quando (e como) começa a cobrança */
export default function TrialCountdown() {
  const { sub, loading } = useSubscription()
  if (loading || !sub || sub.status !== 'trialing') return null
  const end = isCardTrial(sub) ? periodEnd(sub) : sub.accessUntil
  const days = daysLeft(end)
  if (days <= 0) return null
  const used = Math.min(Math.max(TRIAL_DAYS - days, 0), TRIAL_DAYS)
  const price = formatBRL(PLANS[sub.plan].cents / 100)
  const card = isCardTrial(sub)

  return (
    <section className="trialbar" aria-label="Teste grátis">
      <div className="trialbar__count">
        <strong>{days}</strong>
        <span>{days === 1 ? 'dia grátis' : 'dias grátis'}</span>
      </div>
      <div className="trialbar__body">
        <p className="trialbar__title">
          Plano {PLANS[sub.plan].name} · teste grátis até {longDate.format(end)}
        </p>
        <p className="trialbar__text">
          {card
            ? `A 1ª cobrança de ${price} no cartão será em ${longDate.format(end)}. Até lá, nada é cobrado.`
            : `Para continuar depois do teste, pague ${price}/mês por Pix até ${longDate.format(end)}.`}
        </p>
        <div
          className="trialbar__track"
          role="progressbar"
          aria-label="Dias de teste usados"
          aria-valuemin={0}
          aria-valuemax={TRIAL_DAYS}
          aria-valuenow={used}
        >
          <span style={{ width: `${(used / TRIAL_DAYS) * 100}%` }} />
        </div>
      </div>
      <Link className="trialbar__link" to={dash('/assinatura')}>
        {card ? 'Ver assinatura' : 'Pagar com Pix'}
      </Link>
    </section>
  )
}

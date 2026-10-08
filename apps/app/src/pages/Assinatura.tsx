import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CreditCard, QrCode } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useSubscription } from '../billing/SubscriptionProvider'
import type { ReactNode } from 'react'
import { Button, Card, Em, Money } from '../components/ui'
import { BillingError, openPortal, startCheckout, switchTrialPlan } from '../lib/billingApi'
import { formatBRL } from '../lib/format'
import {
  PIX_DISCOUNT_PCT,
  PIX_MONTHS,
  PLAN_IDS,
  PLANS,
  daysLeft,
  isCardTrial,
  monthsLabel,
  periodEnd,
  pixAmountCents,
  pixFullCents,
  type BillingMethod,
  type PixMonths,
  type PlanId,
} from '../lib/plans'

const Badge = ({ children }: { children: ReactNode }) => <span className="badge badge--concluido">{children}</span>

const longDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function Assinatura() {
  const { sub, state, loading, refresh } = useSubscription()
  const { salon } = useAuth()
  const [params] = useSearchParams()
  const [months, setMonths] = useState<PixMonths>(1)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isOwner = !salon || salon.role === 'owner'
  const returned = params.get('retorno')

  // ao voltar do Stripe o webhook pode levar alguns segundos: consulta de novo algumas vezes
  useEffect(() => {
    if (returned !== 'ok') return
    let tries = 0
    const timer = window.setInterval(() => {
      void refresh()
      if (++tries >= 10) window.clearInterval(timer)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [returned, refresh])

  const hasLiveCard =
    !!sub && sub.method === 'card' && sub.hasCustomer && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') && !sub.cancelAtPeriodEnd

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await action()
    } catch (e) {
      if (e instanceof BillingError && e.code === 'use_portal') {
        try {
          await openPortal()
          return
        } catch (inner) {
          setError(inner instanceof Error ? inner.message : 'Não foi possível abrir o portal agora.')
        }
      } else {
        setError(e instanceof Error ? e.message : 'Não foi possível continuar agora.')
      }
      setBusy(null)
    }
  }

  const pay = (plan: PlanId, method: BillingMethod) => run(`${plan}-${method}`, () => startCheckout(plan, method, months))

  // teste grátis sem forma de pagamento: dá para experimentar outro plano sem pagar
  const canSwitchTrial = state === 'trial' && !!sub && !sub.method
  const tryPlan = (plan: PlanId) =>
    run(`${plan}-trial`, async () => {
      await switchTrialPlan(plan)
      await refresh()
      setBusy(null)
    })

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <p className="eyebrow">Assinatura</p>
          <h1 className="page__title">
            Seu <Em>plano</Em>
          </h1>
        </div>
        {sub?.hasCustomer && isOwner && (
          <div className="page__actions">
            <Button variant="light" disabled={busy === 'portal'} onClick={() => run('portal', openPortal)}>
              {busy === 'portal' ? 'Abrindo…' : 'Gerenciar pagamento'}
            </Button>
          </div>
        )}
      </header>

      {returned === 'ok' && (
        <p className="billing-note billing-note--ok" role="status">
          {sub?.method
            ? 'Tudo certo! Recebemos seu pagamento e sua assinatura está confirmada.'
            : 'Pagamento enviado. Estamos confirmando e atualizando o seu plano, isso leva só alguns segundos.'}
        </p>
      )}
      {returned === 'cancelado' && (
        <p className="billing-note" role="status">
          Pagamento cancelado. Nada foi cobrado.
        </p>
      )}
      {error && (
        <p className="billing-note billing-note--error" role="alert">
          {error}
        </p>
      )}

      {!loading && sub && (
        <Card variant={state === 'expired' ? 'dark' : 'soft'} className="billing-status">
          <div>
            <p className="billing-status__label">
              Plano atual <Badge>{PLANS[sub.plan].name}</Badge>
            </p>
            <p className="billing-status__title">
              {state === 'trial' && !isCardTrial(sub) && (
                <>
                  Teste grátis · restam <Em>{daysLeft(sub.accessUntil)} dias</Em>
                </>
              )}
              {state === 'courtesy' && <>Acesso <Em>liberado</Em></>}
              {state === 'active' && <>Assinatura ativa</>}
              {state === 'ending' && <>Seu acesso termina em breve</>}
              {state === 'past_due' && <>Pagamento pendente</>}
              {state === 'expired' && <>Acesso encerrado</>}
            </p>
            <p className="billing-status__text">
              {state === 'trial' && `Sem cartão. O teste vai até ${longDate.format(sub.accessUntil)}. Durante o teste, você pode experimentar qualquer plano.`}
              {state === 'courtesy' && `Cortesia da IKIZY: você usa o sistema de graça até ${longDate.format(sub.accessUntil)}. Nada será cobrado.`}
              {isCardTrial(sub) && `Teste grátis até ${longDate.format(periodEnd(sub))}. Depois, cobramos ${formatBRL(PLANS[sub.plan].cents / 100)}/mês no cartão, e você pode cancelar antes pelo portal.`}
              {state === 'active' && sub.method === 'card' && !isCardTrial(sub) && `Renova automaticamente no cartão em ${longDate.format(periodEnd(sub))}.`}
              {state === 'active' && sub.method === 'pix' && `Pago por Pix. Acesso até ${longDate.format(sub.accessUntil)}. Para renovar, pague de novo antes dessa data.`}
              {state === 'ending' && `Acesso até ${longDate.format(periodEnd(sub))}. Depois disso o sistema abre só para leitura.`}
              {state === 'past_due' && 'Não conseguimos cobrar o cartão. Atualize o pagamento para manter o acesso.'}
              {state === 'expired' && 'Seus dados continuam salvos e você pode consultá-los. Escolha um plano abaixo para voltar a editar.'}
            </p>
          </div>
        </Card>
      )}

      {!loading && !sub && (
        <p className="billing-note" role="status">
          A assinatura ainda não está disponível para o seu negócio. Quando for ativada, você poderá escolher o plano por aqui.
        </p>
      )}

      {!isOwner && sub && <p className="billing-note">Só a dona do negócio pode assinar ou mudar o plano.</p>}

      {sub && state !== 'courtesy' && (
      <section aria-labelledby="pix-months" className="billing-pix">
        <p id="pix-months" className="billing-pix__label">
          Se pagar com Pix, quantos meses adiantado?
        </p>
        <div className="seg" role="radiogroup" aria-labelledby="pix-months">
          {PIX_MONTHS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={months === m}
              className={`seg__item ${months === m ? 'is-active' : ''}`}
              onClick={() => setMonths(m)}
            >
              {monthsLabel(m)}
              {PIX_DISCOUNT_PCT[m] > 0 && <small className="seg__off">{PIX_DISCOUNT_PCT[m]}% off</small>}
            </button>
          ))}
        </div>
        <p className="billing-pix__hint">O Pix vale para o período escolhido e não renova sozinho. O cartão renova todo mês.</p>
      </section>
      )}

      {sub && state !== 'courtesy' && (
      <div className="billing-plans">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id]
          const current = sub?.plan === id && state !== 'expired'
          const inTrialOffer = state === 'trial'
          const total = pixAmountCents(id, months)
          const full = pixFullCents(id, months)
          const discount = PIX_DISCOUNT_PCT[months]
          return (
            <Card key={id} variant={current ? 'soft' : undefined} className="billing-plan">
              <div className="billing-plan__head">
                <h2>{plan.name}</h2>
                {current && <Badge>Seu plano</Badge>}
                {canSwitchTrial && !current && <Badge>Grátis no teste</Badge>}
              </div>
              <p className="billing-plan__audience">{plan.audience}</p>
              <p className="billing-plan__price">
                <Money value={total / 100} size="xl" />
                <span>{months === 1 ? '/mês' : `/${monthsLabel(months)}`}</span>
              </p>
              <p className="billing-plan__equiv">
                {months === 1 ? (
                  'No Pix por 1 mês, ou renovação mensal no cartão'
                ) : (
                  <>
                    {discount > 0 ? <s>{formatBRL(full / 100)}</s> : null} {discount > 0 ? 'no' : 'No'} Pix, equivale a {formatBRL(total / months / 100)}/mês
                    {discount > 0 && ` (${discount}% de desconto)`}
                  </>
                )}
              </p>
              <ul className="billing-plan__list">
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={16} aria-hidden="true" /> {f}
                  </li>
                ))}
              </ul>

              {canSwitchTrial && !current && (
                <Button variant="light" disabled={!isOwner || busy !== null} onClick={() => tryPlan(id)}>
                  {busy === `${id}-trial` ? 'Trocando…' : 'Testar este plano grátis'}
                </Button>
              )}
              {hasLiveCard ? (
                <Button variant="light" disabled={!isOwner || busy === 'portal'} onClick={() => run('portal', openPortal)}>
                  {current ? 'Gerenciar assinatura' : 'Trocar de plano'}
                </Button>
              ) : (
                <div className="billing-plan__actions">
                  <Button disabled={!isOwner || busy !== null} onClick={() => pay(id, 'card')}>
                    <CreditCard size={16} aria-hidden="true" />
                    {busy === `${id}-card` ? 'Abrindo…' : `Cartão · ${formatBRL(plan.cents / 100)}/mês`}
                  </Button>
                  <Button variant="light" disabled={!isOwner || busy !== null} onClick={() => pay(id, 'pix')}>
                    <QrCode size={16} aria-hidden="true" />
                    {busy === `${id}-pix` ? 'Abrindo…' : `Pix · ${formatBRL(total / 100)}`}
                  </Button>
                </div>
              )}
              {inTrialOffer && <p className="billing-plan__note">Assinando agora, você mantém os dias que sobraram do teste.</p>}
            </Card>
          )
        })}
      </div>
      )}
    </div>
  )
}

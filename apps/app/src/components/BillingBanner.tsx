import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useSubscription } from '../billing/SubscriptionProvider'
import { can } from '../lib/permissions'
import { dash } from '../lib/routes'
import { daysLeft, periodEnd, WARN_DAYS } from '../lib/plans'

const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

/** aviso no topo do sistema: só aparece quando a pessoa precisa agir (teste acabando, Pix vencendo, cartão com falha, sem acesso) */
export default function BillingBanner() {
  const { sub, state, loading } = useSubscription()
  const { salon } = useAuth()
  if (loading || !sub) return null

  // a equipe não paga: só fica sabendo quando o sistema trava, e a quem pedir
  if (!can(salon?.role, 'billing')) {
    if (state !== 'expired') return null
    return (
      <div className="billing-banner billing-banner--alert" role="status">
        <p>O acesso do negócio terminou e o sistema está só para leitura. Fale com a dona para renovar o plano.</p>
      </div>
    )
  }

  const days = daysLeft(sub.accessUntil)
  let tone: 'info' | 'warn' | 'alert' | null = null
  let text = ''

  if (state === 'trial' && days <= WARN_DAYS) {
    tone = 'info'
    text = days <= 1 ? 'Seu teste grátis termina hoje.' : `Seu teste grátis termina em ${days} dias.`
  } else if (state === 'ending') {
    tone = 'warn'
    text = `Seu acesso termina em ${fmt.format(periodEnd(sub))}. Renove para continuar usando.`
  } else if (state === 'past_due') {
    tone = 'warn'
    text = 'Não conseguimos cobrar seu cartão. Atualize o pagamento para não perder o acesso.'
  } else if (state === 'expired') {
    tone = 'alert'
    text = 'Seu acesso terminou e o sistema está só para leitura. Escolha um plano para voltar a editar.'
  }
  if (!tone) return null

  return (
    <div className={`billing-banner billing-banner--${tone}`} role="status">
      <p>{text}</p>
      <Link to={dash('/assinatura')}>{state === 'past_due' ? 'Atualizar pagamento' : 'Ver planos'}</Link>
    </div>
  )
}

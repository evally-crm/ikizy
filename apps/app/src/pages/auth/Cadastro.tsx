import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Mail, User } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { CHOSEN_PLAN_KEY, PLAN_IDS, PLANS, isPlanId, type PlanId } from '../../lib/plans'
import { ROUTES } from '../../lib/routes'
import { formatBRL } from '../../lib/format'
import { Em } from '../../components/ui'
import { AuthCard, AuthField, AuthLayout, AuthSubmit, FormMessages, GoogleButton } from './AuthLayout'

export default function Cadastro() {
  const { status, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // plano: o do link do site (?plano=), o já escolhido neste aparelho ou o mais escolhido (Studio)
  const [plan, setPlan] = useState<PlanId>(() => {
    const fromLink = params.get('plano')
    if (isPlanId(fromLink)) return fromLink
    try {
      const saved = localStorage.getItem(CHOSEN_PLAN_KEY)
      if (isPlanId(saved)) return saved
    } catch {
      // sem armazenamento: vale o padrão
    }
    return DEFAULT_PLAN
  })
  // guardado já na escolha: vale também para quem segue pelo Google
  useEffect(() => {
    try {
      localStorage.setItem(CHOSEN_PLAN_KEY, plan)
    } catch {
      // sem armazenamento: o teste começa no plano padrão
    }
  }, [plan])

  if (status === 'ready' || status === 'demo') return <Navigate to={ROUTES.dashboard} replace />
  if (status === 'no-salon') return <Navigate to={ROUTES.createSalon} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) {
      setError('Conte como você se chama.')
      return
    }
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    setBusy(true)
    const res = await signUp(email, password, name)
    setBusy(false)
    // conta criada: o Neon Auth mandou um código de 6 números para confirmar o e-mail
    if (!res.error && res.needsConfirmation) {
      navigate(`${ROUTES.verifyEmail}?email=${encodeURIComponent(email.trim())}`)
      return
    }
    setError(res.error)
  }

  const onGoogle = async () => {
    setError(null)
    setBusy(true)
    const err = await signInWithGoogle()
    // sem erro, o navegador já está indo para o Google
    if (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      topAction={
        <Link to={ROUTES.login} className="auth__toplink">
          Entrar
        </Link>
      }
    >
      <AuthCard
        title={
          <>
            <Em>Criar</Em> sua conta
          </>
        }
        subtitle="30 dias grátis, sem cartão. Leva um minuto."
        aside={<GoogleButton onClick={onGoogle} disabled={busy} />}
      >
        <form className="form" onSubmit={onSubmit}>
          <AuthField
            label="Seu nome"
            icon={<User size={16} />}
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Como as clientes te chamam"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <AuthField
            label="E-mail"
            icon={<Mail size={16} />}
            type="email"
            autoComplete="email"
            required
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <AuthField
            label="Senha"
            icon={<Lock size={16} />}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="Mínimo de 8 caracteres."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PlanChoice value={plan} onChange={setPlan} />
          <FormMessages error={error} />
          <AuthSubmit label="Criar conta" disabled={busy} />
        </form>
      </AuthCard>
    </AuthLayout>
  )
}

/** plano mais escolhido: já vem marcado, como na página de preços do site */
const DEFAULT_PLAN: PlanId = 'studio'

const PLAN_LINE: Record<PlanId, string> = {
  solo: 'Para quem atende sozinha',
  studio: 'Equipe pequena, com comissões',
  salao: 'Equipe maior',
}

/** lista de escolha igual à do site: o marcado fica branco e os outros ficam cinza e apagados; 30 dias grátis em todos */
function PlanChoice({ value, onChange }: { value: PlanId; onChange: (plan: PlanId) => void }) {
  return (
    <fieldset className="plans">
      <legend className="plans__legend">Escolha seu plano</legend>
      {PLAN_IDS.map((id) => (
        <label key={id} className="plan">
          <input type="radio" name="plano" value={id} checked={value === id} onChange={() => onChange(id)} />
          <span className="plan__radio" aria-hidden="true" />
          <span className="plan__info">
            <b>{PLANS[id].name}</b>
            <small>{PLAN_LINE[id]}</small>
          </span>
          <span className="plan__price">
            <b>{formatBRL(PLANS[id].cents / 100)}</b>
            <small>/mês</small>
          </span>
          {id === DEFAULT_PLAN && <span className="plan__tag">Mais escolhido</span>}
        </label>
      ))}
      <p className="plans__note">30 dias grátis em qualquer plano, sem cartão.</p>
    </fieldset>
  )
}

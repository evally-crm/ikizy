import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Mail, User } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { CHOSEN_PLAN_KEY, isPlanId } from '../../lib/plans'
import { ROUTES } from '../../lib/routes'
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

  // guarda o plano do site para depois do cadastro (inclusive passando pelo Google)
  useEffect(() => {
    const plan = params.get('plano')
    if (!isPlanId(plan)) return
    try {
      localStorage.setItem(CHOSEN_PLAN_KEY, plan)
    } catch {
      // sem armazenamento: o teste começa no plano que combina com a equipe
    }
  }, [params])

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
            Crie sua <Em>conta</Em>
          </>
        }
        subtitle="30 dias grátis, sem cartão. Leva um minuto."
      >
        <GoogleButton wide onClick={onGoogle} disabled={busy} />
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
          <FormMessages error={error} />
          <AuthSubmit label="Criar conta" disabled={busy} />
        </form>
      </AuthCard>
    </AuthLayout>
  )
}

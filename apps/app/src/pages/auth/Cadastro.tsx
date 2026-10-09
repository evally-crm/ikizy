import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { ROUTES } from '../../lib/routes'
import { Em } from '../../components/ui'
import { AuthCard, AuthField, AuthLayout, AuthSubmit, FormMessages, GoogleButton } from './AuthLayout'

export default function Cadastro() {
  const { status, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'ready' || status === 'demo') return <Navigate to={ROUTES.dashboard} replace />
  if (status === 'no-salon') return <Navigate to={ROUTES.createSalon} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    setBusy(true)
    const res = await signUp(email, password)
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
        aside={<GoogleButton onClick={onGoogle} disabled={busy} />}
        title={
          <>
            Crie sua <Em>conta</Em>
          </>
        }
        subtitle="Leva um minuto. Depois você monta o seu negócio."
      >
        <form className="form" onSubmit={onSubmit}>
          <AuthField
            label="E-mail"
            icon={<Mail size={16} />}
            type="email"
            autoComplete="email"
            required
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

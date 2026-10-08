import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { noSalonPath } from '../../lib/invite'
import { ROUTES } from '../../lib/routes'
import { Em } from '../../components/ui'
import { AuthCard, AuthField, AuthLayout, AuthSubmit, FormMessages, GoogleButton } from './AuthLayout'

export default function Login() {
  const { status, signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'ready' || status === 'demo') return <Navigate to={ROUTES.dashboard} replace />
  if (status === 'no-salon') return <Navigate to={noSalonPath()} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    setError(await signIn(email, password))
    setBusy(false)
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
        <Link to={ROUTES.signup} className="auth__toplink">
          Criar conta
        </Link>
      }
    >
      <AuthCard
        aside={<GoogleButton onClick={onGoogle} disabled={busy} />}
        title={
          <>
            Bem-vinda de <Em>volta</Em>
          </>
        }
        subtitle="Entre para ver a agenda e o caixa do seu negócio."
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            action={
              <Link to={ROUTES.recover} className="auth__pill">
                Esqueci
              </Link>
            }
          />
          <FormMessages error={error} />
          <AuthSubmit label="Entrar" disabled={busy} />
        </form>
      </AuthCard>
    </AuthLayout>
  )
}

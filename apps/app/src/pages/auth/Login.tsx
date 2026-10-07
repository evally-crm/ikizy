import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { ROUTES } from '../../lib/routes'
import { Button, Em } from '../../components/ui'
import { AuthCard, AuthField, AuthLayout, FormMessages, GoogleButton } from './AuthLayout'

export default function Login() {
  const { status, signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'ready' || status === 'demo') return <Navigate to={ROUTES.dashboard} replace />
  if (status === 'no-salon') return <Navigate to={ROUTES.createSalon} replace />

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
    <AuthLayout>
      <AuthCard
        title={
          <>
            Bem-vinda de <Em>volta</Em>
          </>
        }
        subtitle="Entre para ver a agenda e o caixa do seu negócio."
      >
        <GoogleButton onClick={onGoogle} disabled={busy} />
        <form className="form" onSubmit={onSubmit}>
          <AuthField label="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <AuthField
            label="Senha"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link to={ROUTES.recover} className="textlink auth__forgot">
            Esqueci minha senha
          </Link>
          <FormMessages error={error} />
          <Button type="submit" disabled={busy}>
            <LogIn size={16} aria-hidden="true" />
            {busy ? 'Aguarde…' : 'Entrar'}
          </Button>
        </form>
        <p className="auth__switch">
          Ainda não tem conta?{' '}
          <Link to={ROUTES.signup} className="textlink">
            Criar conta
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  )
}

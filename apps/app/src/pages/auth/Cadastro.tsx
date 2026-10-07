import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowRight, Lock, Mail } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { ROUTES } from '../../lib/routes'
import { Button, Em } from '../../components/ui'
import { AuthCard, AuthField, AuthLayout, FormMessages, GoogleButton } from './AuthLayout'

export default function Cadastro() {
  const { status, signUp, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (status === 'ready' || status === 'demo') return <Navigate to={ROUTES.dashboard} replace />
  if (status === 'no-salon') return <Navigate to={ROUTES.createSalon} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    setBusy(true)
    const res = await signUp(email, password)
    setError(res.error)
    if (!res.error && res.needsConfirmation) {
      setNotice('Enviamos um link de confirmação para o seu e-mail. Confirme e volte aqui para entrar.')
    }
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
        tabs="signup"
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
          <FormMessages error={error} notice={notice} />
          <Button type="submit" className="auth__submit" disabled={busy}>
            {busy ? 'Aguarde…' : 'Criar conta'}
            <span className="auth__arrow" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  )
}

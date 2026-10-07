import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { Button, Card, Em } from '../components/ui'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <div className="shell__orb" aria-hidden="true" />
      <div className="auth__box">
        <p className="logo auth__logo">
          IKIZY<span className="logo__dot">.</span>
        </p>
        {children}
      </div>
    </div>
  )
}

export function AuthField({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <span className="input">
        <input id={id} {...input} />
      </span>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  )
}

export default function Auth() {
  const { status, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (status === 'ready' || status === 'demo') return <Navigate to="/" replace />
  if (status === 'no-salon') return <Navigate to="/comecar" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (mode === 'criar' && password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    setBusy(true)
    if (mode === 'entrar') {
      setError(await signIn(email, password))
    } else {
      const res = await signUp(email, password)
      setError(res.error)
      if (!res.error && res.needsConfirmation) setNotice('Enviamos um link de confirmação para o seu e-mail. Confirme e volte aqui para entrar.')
    }
    setBusy(false)
  }

  return (
    <AuthLayout>
      <Card className="auth__card">
        <h1 className="auth__title">
          {mode === 'entrar' ? (
            <>
              Bem-vinda de <Em>volta</Em>
            </>
          ) : (
            <>
              Crie sua <Em>conta</Em>
            </>
          )}
        </h1>
        <p className="card__sub">
          {mode === 'entrar' ? 'Entre para ver a agenda e o caixa do seu salão.' : 'Leva um minuto. Depois você monta o seu salão.'}
        </p>

        <form className="form" onSubmit={onSubmit} noValidate={false}>
          <AuthField
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <AuthField
            label="Senha"
            type="password"
            autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'criar' ? 8 : undefined}
            hint={mode === 'criar' ? 'Mínimo de 8 caracteres.' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="alert alert--ok" role="status">
              {notice}
            </p>
          )}

          <Button type="submit" disabled={busy}>
            <LogIn size={16} aria-hidden="true" />
            {busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        <p className="auth__switch">
          {mode === 'entrar' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
          <button
            type="button"
            className="textlink"
            onClick={() => {
              setMode(mode === 'entrar' ? 'criar' : 'entrar')
              setError(null)
              setNotice(null)
            }}
          >
            {mode === 'entrar' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </Card>
    </AuthLayout>
  )
}

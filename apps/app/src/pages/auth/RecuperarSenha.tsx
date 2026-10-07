import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { ROUTES } from '../../lib/routes'
import { Button, Em } from '../../components/ui'
import { AuthCard, AuthField, AuthLayout, FormMessages } from './AuthLayout'

export default function RecuperarSenha() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const err = await sendPasswordReset(email)
    setError(err)
    setSent(!err)
    setBusy(false)
  }

  return (
    <AuthLayout>
      <AuthCard
        title={
          <>
            Recuperar <Em>senha</Em>
          </>
        }
        subtitle="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha."
      >
        <form className="form" onSubmit={onSubmit}>
          <AuthField label="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormMessages
            error={error}
            notice={sent ? 'Se esse e-mail tiver uma conta, o link de recuperação já está a caminho. Confira também o spam.' : null}
          />
          <Button type="submit" disabled={busy}>
            <Mail size={16} aria-hidden="true" />
            {busy ? 'Enviando…' : 'Enviar link'}
          </Button>
        </form>
        <p className="auth__switch">
          <Link to={ROUTES.login} className="textlink">
            Voltar para o login
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { ROUTES } from '../../lib/routes'
import { Button, Em } from '../../components/ui'
import { AuthCard, AuthField, AuthLayout, FormMessages } from './AuthLayout'

/** destino do link de recuperação: o Neon Auth envia ?token=... e aqui definimos a nova senha */
export default function RedefinirSenha() {
  const { status, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') return null

  if (!token) {
    return (
      <AuthLayout>
        <AuthCard
          title={
            <>
              Link <Em>expirado</Em>
            </>
          }
          subtitle="Esse link de recuperação é inválido ou já foi usado. Peça um novo para continuar."
        >
          <Link to={ROUTES.recover} className="btn btn--primary">
            Pedir novo link
          </Link>
        </AuthCard>
      </AuthLayout>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não conferem.')
      return
    }
    setBusy(true)
    const err = await updatePassword(password, token)
    setBusy(false)
    if (err) setError(err)
    else navigate(ROUTES.login, { replace: true })
  }

  return (
    <AuthLayout>
      <AuthCard
        title={
          <>
            Nova <Em>senha</Em>
          </>
        }
        subtitle="Escolha uma senha forte, com pelo menos 8 caracteres."
      >
        <form className="form" onSubmit={onSubmit}>
          <AuthField
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <AuthField
            label="Repita a nova senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <FormMessages error={error} />
          <Button type="submit" disabled={busy}>
            <KeyRound size={16} aria-hidden="true" />
            {busy ? 'Salvando…' : 'Salvar nova senha'}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { ROUTES } from '../../lib/routes'
import { noSalonPath } from '../../lib/pendingInvite'
import { Em } from '../../components/ui'
import { AuthCard, AuthField, AuthLayout, AuthSubmit, FormMessages } from './AuthLayout'

/** espera entre um reenvio e outro, para não disparar vários e-mails seguidos */
const RESEND_WAIT_S = 60

/**
 * /verificar-email?email=...: depois do cadastro (ou de um login com e-mail ainda não confirmado)
 * o Neon Auth manda um código de 6 dígitos; com o código certo a sessão abre e o cadastro segue.
 */
export default function VerificarEmail() {
  const { status, verifyEmailCode, resendVerificationCode } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  // quem chega pelo login: o código já saiu agora, então o reenvio começa bloqueado também
  const location = useLocation()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [wait, setWait] = useState(RESEND_WAIT_S)

  useEffect(() => {
    if (wait <= 0) return
    const timer = window.setTimeout(() => setWait(wait - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  if (status === 'ready' || status === 'demo') return <Navigate to={ROUTES.dashboard} replace />
  if (status === 'no-salon') return <Navigate to={noSalonPath()} replace />
  if (!email) return <Navigate to={ROUTES.signup} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!/^\d{6}$/.test(code)) {
      setError('Digite os 6 números do código.')
      return
    }
    setBusy(true)
    const res = await verifyEmailCode(email, code)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    // sessão aberta: o dashboard decide entre o questionário e o painel; sem sessão, entra com a senha
    if (res.signedIn) navigate(ROUTES.dashboard, { replace: true })
    else navigate(ROUTES.login, { replace: true, state: { verified: true, email } })
  }

  const onResend = async () => {
    setError(null)
    setNotice(null)
    setWait(RESEND_WAIT_S)
    const err = await resendVerificationCode(email)
    if (err) {
      setError(err)
      setWait(0)
    } else setNotice('Enviamos um novo código. Confira também o spam.')
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
            <Em>Confirme</Em> seu e-mail
          </>
        }
        subtitle={`Enviamos um código de 6 números para ${email}. Ele vale por alguns minutos.`}
      >
        <form className="form" onSubmit={onSubmit}>
          <AuthField
            label="Código de 6 números"
            icon={<ShieldCheck size={16} />}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <FormMessages error={error} notice={notice ?? (location.state?.fromLogin ? 'Seu e-mail ainda não foi confirmado. Mandamos um código agora.' : null)} />
          <AuthSubmit label="Confirmar e-mail" disabled={busy} />
        </form>
        <p className="auth__switch">
          {wait > 0 ? (
            <span>Reenviar código em {wait}s</span>
          ) : (
            <button type="button" className="textlink" onClick={() => void onResend()}>
              Reenviar código
            </button>
          )}
          {' · '}
          <Link to={ROUTES.signup} className="textlink">
            Usar outro e-mail
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  )
}

import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, LogOut, UserPlus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { Button, Em } from '../../components/ui'
import { inviteStateText, invitePath, isInviteToken, ROLE_HINT, ROLE_LABEL, type InviteState, type Role } from '../../domain/team'
import { neon } from '../../lib/neon'
import { clearPendingInvite, savePendingInvite } from '../../lib/pendingInvite'
import { ROUTES } from '../../lib/routes'
import { AuthCard, AuthLayout, FormMessages } from '../auth/AuthLayout'
import './Convite.css'

interface InviteInfo {
  salon: string
  role: Role
  professional: string | null
  state: InviteState
}

/**
 * /convite/<token>: quem foi convidada para a equipe cria a conta (ou entra) e é ligada ao negócio.
 * Sem conta, o token fica guardado no aparelho e a pessoa volta para cá depois do cadastro ou do login.
 */
export default function Convite() {
  const { token = '' } = useParams()
  const { status, salon, signOut, acceptInvite } = useAuth()
  const navigate = useNavigate()
  const valid = isInviteToken(token)
  const [info, setInfo] = useState<InviteInfo | null | 'loading'>(valid ? 'loading' : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!valid || !neon) return
    let cancelled = false
    void neon.rpc('get_invite', { p_token: token }).then(({ data }) => {
      if (!cancelled) setInfo((data as InviteInfo | null) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [token, valid])

  // convite que vale: guarda para depois do cadastro/login; convite que não vale: esquece
  useEffect(() => {
    if (info === 'loading') return
    if (info?.state === 'ok') savePendingInvite(token)
    else clearPendingInvite()
  }, [info, token])

  if (status === 'demo') return <Navigate to={ROUTES.dashboard} replace />

  const accept = async () => {
    setBusy(true)
    setError(null)
    const message = await acceptInvite(token)
    setBusy(false)
    if (message) return setError(message)
    clearPendingInvite()
    navigate(ROUTES.dashboard, { replace: true })
  }

  const back = { from: invitePath(token) }

  return (
    <AuthLayout
      topAction={
        status === 'signed-out' ? (
          <Link to={ROUTES.login} state={back} className="auth__toplink">
            Entrar
          </Link>
        ) : undefined
      }
    >
      {info === 'loading' || status === 'loading' ? (
        <div className="invite__wait" role="status">
          Abrindo o convite…
        </div>
      ) : !info || info.state !== 'ok' ? (
        <AuthCard title={<>Convite <Em>indisponível</Em></>} subtitle={info ? (inviteStateText(info.state) ?? '') : 'Este link de convite não existe. Confira se ele foi copiado inteiro.'}>
          <div className="invite__actions">
            <Link to={ROUTES.login} className="btn btn--primary">
              Ir para o login <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </AuthCard>
      ) : (
        <AuthCard
          title={
            <>
              Bem-vinda à equipe do <Em>{info.salon}</Em>
            </>
          }
          subtitle={
            info.professional
              ? `Você vai entrar como ${info.professional}, com o perfil ${ROLE_LABEL[info.role].toLowerCase()}.`
              : `Você vai entrar com o perfil ${ROLE_LABEL[info.role].toLowerCase()}.`
          }
        >
          <div className="invite__role">
            <span className="invite__badge">{ROLE_LABEL[info.role]}</span>
            <p>{ROLE_HINT[info.role]}</p>
          </div>

          <FormMessages error={error} />

          {status === 'signed-out' && (
            <div className="invite__actions">
              <Link to={ROUTES.signup} className="btn btn--primary">
                <UserPlus size={16} aria-hidden="true" /> Criar minha conta
              </Link>
              <Link to={ROUTES.login} state={back} className="btn btn--ghost">
                Já tenho conta
              </Link>
            </div>
          )}

          {status === 'no-salon' && (
            <div className="invite__actions">
              <Button onClick={() => void accept()} disabled={busy}>
                {busy ? 'Entrando…' : 'Entrar na equipe'} <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          )}

          {status === 'ready' && (
            <>
              <p className="alert" role="alert">
                Esta conta já faz parte do {salon?.name ?? 'outro negócio'}. Cada conta entra em um negócio só: para aceitar, saia e crie uma conta com outro
                e-mail.
              </p>
              <div className="invite__actions">
                <Button onClick={() => void signOut()}>
                  <LogOut size={16} aria-hidden="true" /> Sair e usar outro e-mail
                </Button>
                <Link to={ROUTES.dashboard} className="btn btn--ghost">
                  Voltar ao sistema
                </Link>
              </div>
            </>
          )}
        </AuthCard>
      )}
    </AuthLayout>
  )
}

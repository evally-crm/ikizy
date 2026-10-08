import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth, type MemberRole } from '../../auth/AuthProvider'
import { Button, Em } from '../../components/ui'
import { clearPendingInvite, isInviteToken, savePendingInvite } from '../../lib/invite'
import { neon } from '../../lib/neon'
import { ROLE_LABEL } from '../../lib/permissions'
import { ROUTES } from '../../lib/routes'
import { AuthCard, AuthLayout, FormMessages } from './AuthLayout'

interface InviteInfo {
  salon: string
  role: MemberRole
  name: string
  status: 'valid' | 'used' | 'expired'
}

/** /convite/:token — quem recebeu o link entra ou cria a conta e aceita fazer parte da equipe */
export default function Convite() {
  const { token = '' } = useParams()
  const { status, displayName, acceptInvite, signOut } = useAuth()
  const navigate = useNavigate()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = isInviteToken(token)

  // guarda o convite para voltar a ele depois de criar a conta, entrar ou confirmar o e-mail
  useEffect(() => {
    if (valid && status !== 'ready') savePendingInvite(token)
  }, [valid, token, status])

  // detalhes do convite: só para quem já está logada (o banco não abre convites para visitantes)
  useEffect(() => {
    if (!valid || !neon || (status !== 'no-salon' && status !== 'ready')) return
    let alive = true
    void neon.rpc('get_invite', { p_token: token }).then(({ data }) => {
      if (!alive) return
      setInfo((data as InviteInfo | null) ?? null)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [valid, token, status])

  if (status === 'demo') return <Navigate to={ROUTES.dashboard} replace />

  const accept = async () => {
    setBusy(true)
    setError(null)
    const err = await acceptInvite(token)
    setBusy(false)
    if (err) return setError(err)
    clearPendingInvite()
    navigate(ROUTES.dashboard, { replace: true })
  }

  const notForMe = () => {
    clearPendingInvite()
    navigate(ROUTES.createSalon, { replace: true })
  }

  let content
  if (!valid) {
    content = (
      <AuthCard title={<>Convite <Em>inválido</Em></>} subtitle="Confira se o link foi copiado inteiro ou peça um novo para a dona do negócio.">
        <Link to={ROUTES.login} className="btn btn--light">
          Ir para o login
        </Link>
      </AuthCard>
    )
  } else if (status === 'loading' || ((status === 'no-salon' || status === 'ready') && !loaded)) {
    content = (
      <AuthCard title={<>Abrindo o <Em>convite</Em>…</>}>
        <span className="sr-only" role="status">
          Carregando…
        </span>
      </AuthCard>
    )
  } else if (status === 'signed-out') {
    content = (
      <AuthCard
        title={<>Você foi convidada para uma <Em>equipe</Em></>}
        subtitle="Crie sua conta ou entre com a que você já tem. Depois disso, é só aceitar o convite."
      >
        <div className="invite__actions">
          <Link to={ROUTES.signup} className="btn btn--primary">
            Criar minha conta
          </Link>
          <Link to={ROUTES.login} className="btn btn--light">
            Já tenho conta
          </Link>
        </div>
      </AuthCard>
    )
  } else if (!info) {
    content = (
      <AuthCard title={<>Convite não <Em>encontrado</Em></>} subtitle="O link pode ter sido cancelado. Peça um novo para a dona do negócio.">
        <div className="invite__actions">
          <Link to={status === 'ready' ? ROUTES.dashboard : ROUTES.createSalon} className="btn btn--light" onClick={clearPendingInvite}>
            {status === 'ready' ? 'Voltar ao sistema' : 'Criar meu próprio negócio'}
          </Link>
        </div>
      </AuthCard>
    )
  } else if (status === 'ready') {
    content = (
      <AuthCard
        title={<>Você já tem um <Em>negócio</Em></>}
        subtitle={`Esta conta já faz parte de um negócio no IKIZY. Para entrar na equipe de ${info.salon}, saia e use outro e-mail.`}
      >
        <div className="invite__actions">
          <Link to={ROUTES.dashboard} className="btn btn--light" onClick={clearPendingInvite}>
            Voltar ao sistema
          </Link>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sair e usar outro e-mail
          </Button>
        </div>
      </AuthCard>
    )
  } else if (info.status !== 'valid') {
    content = (
      <AuthCard
        title={info.status === 'used' ? <>Convite já <Em>usado</Em></> : <>Convite <Em>vencido</Em></>}
        subtitle={`Peça um novo link para ${info.salon}. Cada convite vale 7 dias e uma única vez.`}
      >
        <div className="invite__actions">
          <Button variant="light" onClick={notForMe}>
            Criar meu próprio negócio
          </Button>
        </div>
      </AuthCard>
    )
  } else {
    content = (
      <AuthCard
        title={<>Entrar na equipe de <Em>{info.salon}</Em></>}
        subtitle={`Você vai entrar como ${ROLE_LABEL[info.role].toLowerCase()}, com o nome ${displayName}.`}
      >
        <FormMessages error={error} />
        <div className="invite__actions">
          <Button onClick={() => void accept()} disabled={busy}>
            {busy ? 'Entrando…' : 'Aceitar convite'}
          </Button>
          <Button variant="ghost" onClick={notForMe} disabled={busy}>
            Não, quero criar meu negócio
          </Button>
        </div>
      </AuthCard>
    )
  }

  return <AuthLayout>{content}</AuthLayout>
}

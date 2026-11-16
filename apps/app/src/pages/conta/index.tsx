import { useEffect, useState, type FormEvent } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronRight, CreditCard, Download, KeyRound, LogOut, Mail, MonitorSmartphone, ShieldCheck, Store, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useSubscription } from '../../billing/SubscriptionProvider'
import { DarkModeRow } from '../../components/DarkModeRow'
import { PushCard } from '../../components/PushCard'
import { ChangePasswordDialog, DevicesDialog } from '../../components/SecurityDialogs'
import { NoticeDialog } from '../../components/Modal'
import { Avatar, Button, Em, PageHeader } from '../../components/ui'
import { roleAccess, ROLE_LABEL } from '../../domain/team'
import { daysLeft, describeSubscription, isCardTrial, periodEnd } from '../../lib/plans'
import { downloadMyData } from '../../lib/accountApi'
import { BillingError } from '../../lib/billingApi'
import { hasPasswordLogin } from '../../lib/security'
import { dash } from '../../lib/routes'
import './Conta.css'

/** /dashboard/conta: o perfil de quem está logada — dados, plano, segurança, aparência e exclusão da conta */
export default function Conta() {
  const { displayName, salon, session, status, updateProfile, signOut, cancelDeletion, deletionAt, sendPasswordReset, isAdmin } = useAuth()
  const { sub } = useSubscription()
  const navigate = useNavigate()
  const access = roleAccess(salon?.role ?? 'owner')
  const isOwner = !salon || salon.role === 'owner'
  const canEditSalon = !salon || salon.role === 'owner' || salon.role === 'manager'
  const email = session?.user.email ?? null
  const demo = status === 'demo'

  // só o que a pessoa digitou fica guardado; sem isso vale o dado atual, que pode chegar depois de a tela abrir
  const [userEdit, setUserName] = useState<string | null>(null)
  const [salonEdit, setSalonName] = useState<string | null>(null)
  const userName = userEdit ?? displayName
  const salonName = salonEdit ?? salon?.name ?? ''
  const dirty = userName.trim() !== displayName || (canEditSalon && salonName.trim() !== (salon?.name ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
    const [resetSent, setResetSent] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [showDevices, setShowDevices] = useState(false)
  // quem entra só pelo Google não tem senha para trocar; enquanto não sabemos, a linha fica escondida
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  useEffect(() => {
    if (status !== 'ready') return
    let alive = true
    void hasPasswordLogin().then((v) => alive && setHasPassword(v))
    return () => {
      alive = false
    }
  }, [status])
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exported, setExported] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || busy) return
    setBusy(true)
    setSaved(false)
    const message = await updateProfile(userName, canEditSalon ? salonName : (salon?.name ?? salonName))
    setBusy(false)
    setError(message)
    if (!message) {
      setUserName(null)
      setSalonName(null)
      setSaved(true)
    }
  }

  const exportData = async () => {
    setExporting(true)
    setExportError(null)
    setExported(false)
    try {
      await downloadMyData()
      setExported(true)
    } catch (e) {
      setExportError(e instanceof BillingError ? e.message : 'Não foi possível baixar agora. Tente novamente.')
    }
    setExporting(false)
  }
  const trialDays = sub?.status === 'trialing' ? daysLeft(isCardTrial(sub) ? periodEnd(sub) : sub.accessUntil) : 0
  const first = displayName.split(' ')[0]

  return (
    <div className="page conta">
      <PageHeader
        title={
          <>
            Minha <Em>conta</Em>
          </>
        }
        crumb={`${first}, seus dados e preferências`}
      />

      <div className="conta__grid">
        <aside className="conta__side">
          <section className="conta__hero">
            <Avatar name={displayName} size="lg" />
            <div className="conta__who">
              <strong>{displayName}</strong>
              {email && <small>{email}</small>}
              <span className="badge badge--dark">{ROLE_LABEL[salon?.role ?? 'owner']}</span>
            </div>
            {salon && (
              <p className="conta__salon">
                <Store size={16} aria-hidden="true" />
                <span>
                  {salon.name}
                  <small>{salon.slug}.ikizy.com</small>
                </span>
              </p>
            )}
          </section>

          {isOwner && sub && (
            <NavLink to={dash('/assinatura')} className="plancard">
              <span className="plancard__icon">
                <CreditCard size={18} aria-hidden="true" />
              </span>
              <span className="plancard__text">
                <strong>{trialDays > 0 ? `Teste grátis · ${trialDays === 1 ? 'último dia' : `${trialDays} dias`}` : 'Seu plano'}</strong>
                <small>{trialDays > 0 ? 'Escolha um plano para seguir depois do teste, sem perder nada.' : describeSubscription(sub)}</small>
              </span>
              <span className="plancard__btn">
                {trialDays > 0 ? 'Ver planos' : 'Gerenciar'} <ChevronRight size={14} aria-hidden="true" />
              </span>
            </NavLink>
          )}

          <ul className="settings__list">
            {access.business && (
              <li>
                <NavLink to={dash('/negocio')} className="settings__row">
                  <Store size={19} aria-hidden="true" />
                  <span>Meu negócio</span>
                  <ChevronRight size={17} aria-hidden="true" />
                </NavLink>
              </li>
            )}
            {access.billing && (
              <li>
                <NavLink to={dash('/assinatura')} className="settings__row">
                  <CreditCard size={19} aria-hidden="true" />
                  <span>Assinatura</span>
                  <ChevronRight size={17} aria-hidden="true" />
                </NavLink>
              </li>
            )}
            {isAdmin && (
              <li>
                <NavLink to={dash('/admin')} className="settings__row">
                  <ShieldCheck size={19} aria-hidden="true" />
                  <span>Acesso master</span>
                  <ChevronRight size={17} aria-hidden="true" />
                </NavLink>
              </li>
            )}
            <li>
              <DarkModeRow />
            </li>
          </ul>
        </aside>

        <div className="conta__main">
          <form className="conta__card" onSubmit={onSave}>
            <h2 className="conta__title">Dados pessoais</h2>
            <p className="conta__hint">É assim que você aparece na agenda e nos avisos para a equipe.</p>
            <div className="form">
              <label className="field">
                <span className="field__label">Seu nome</span>
                <span className="input">
                  <input
                    value={userName}
                    onChange={(e) => {
                      setUserName(e.target.value)
                      setSaved(false)
                    }}
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </span>
              </label>
              {salon && (
                <label className="field">
                  <span className="field__label">Nome do negócio</span>
                  <span className="input">
                    <input
                      value={salonName}
                      onChange={(e) => {
                        setSalonName(e.target.value)
                        setSaved(false)
                      }}
                      autoComplete="organization"
                      required
                      minLength={2}
                      maxLength={60}
                      disabled={!canEditSalon}
                    />
                  </span>
                  {!canEditSalon ? (
                    <span className="field__hint">Só dona ou gerente altera o negócio.</span>
                  ) : (
                    <span className="field__hint">
                      O endereço <strong>{salon.slug}</strong> não muda, para não quebrar links já compartilhados.
                    </span>
                  )}
                </label>
              )}
              {email && (
                <label className="field">
                  <span className="field__label">E-mail</span>
                  <span className="input">
                    <input value={email} disabled readOnly />
                  </span>
                </label>
              )}
            </div>
            {error && (
              <p className="dialog__error" role="alert">
                {error}
              </p>
            )}
            <div className="conta__actions">
              <Button type="submit" disabled={!dirty || busy}>
                {busy ? 'Salvando…' : 'Salvar alterações'}
              </Button>
              {saved && !dirty && (
                <span className="conta__saved" role="status">
                  Alterações salvas
                </span>
              )}
            </div>
          </form>

          {!demo && session && salon && salon.role !== 'professional' && <PushCard />}

          {!demo && session && isOwner && (
            <section className="conta__card">
              <h2 className="conta__title">Seus dados</h2>
              <p className="conta__hint">
                Baixe uma cópia do negócio: clientes, atendimentos, serviços, saídas e equipe, em planilhas que abrem no Excel. As fotos e as
                assinaturas não vão no arquivo. Tem dados pessoais das suas clientes, então guarde num lugar seguro.
              </p>
              {exportError && (
                <p className="dialog__error" role="alert">
                  {exportError}
                </p>
              )}
              <div className="conta__actions">
                <Button disabled={exporting} onClick={() => void exportData()}>
                  <Download size={16} aria-hidden="true" /> {exporting ? 'Preparando…' : 'Baixar meus dados'}
                </Button>
                {exported && (
                  <span className="conta__saved" role="status">
                    Arquivo baixado
                  </span>
                )}
              </div>
            </section>
          )}

          {!demo && (
            <section className="conta__card">
              <h2 className="conta__title">Segurança</h2>
              <ul className="settings__list conta__flat">
                {hasPassword && (
                  <li>
                    <button type="button" className="settings__row" onClick={() => setChangingPassword(true)}>
                      <KeyRound size={19} aria-hidden="true" />
                      <span>
                        Alterar senha
                        <small className="conta__sub">Troque a senha que você usa para entrar</small>
                      </span>
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </li>
                )}
                <li>
                  <button type="button" className="settings__row" onClick={() => setShowDevices(true)}>
                    <MonitorSmartphone size={19} aria-hidden="true" />
                    <span>
                      Aparelhos conectados
                      <small className="conta__sub">Veja onde sua conta está aberta e encerre o que não reconhece</small>
                    </span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </li>
                {email && hasPassword !== false && (
                  <li>
                    <button
                      type="button"
                      className="settings__row"
                      onClick={() => {
                        setResetSent(true)
                        void sendPasswordReset(email)
                      }}
                    >
                      <Mail size={19} aria-hidden="true" />
                      <span>
                        Esqueci a senha
                        <small className="conta__sub">Enviamos um link para criar outra em {email}</small>
                      </span>
                      <Mail size={17} aria-hidden="true" />
                    </button>
                  </li>
                )}
                <li>
                  <button type="button" className="settings__row" onClick={() => void signOut()}>
                    <LogOut size={19} aria-hidden="true" />
                    <span>Sair da conta</span>
                  </button>
                </li>
              </ul>
            </section>
          )}

          {!demo && session && isOwner && deletionAt && (
            <section className="conta__card conta__danger">
              <h2 className="conta__title">Exclusão agendada</h2>
              <p className="conta__hint">
                Sua conta e o negócio serão apagados em <strong>{deletionAt.toLocaleDateString('pt-BR')}</strong>. Até lá nada muda e você pode desistir.
              </p>
              {cancelError && (
                <p className="dialog__error" role="alert">
                  {cancelError}
                </p>
              )}
              <Button
                disabled={cancelBusy}
                onClick={async () => {
                  setCancelBusy(true)
                  setCancelError(null)
                  const message = await cancelDeletion()
                  setCancelBusy(false)
                  setCancelError(message)
                }}
              >
                {cancelBusy ? 'Cancelando…' : 'Cancelar exclusão'}
              </Button>
            </section>
          )}

          {!demo && session && !(isOwner && deletionAt) && (
            <section className="conta__card conta__danger">
              <h2 className="conta__title">Excluir conta</h2>
              <p className="conta__hint">
                {isOwner
                  ? 'Você tem 7 dias para desistir. Depois, apagamos de vez o negócio, as clientes, a agenda, o caixa, as fotos e o site, e removemos o acesso da equipe. A assinatura no cartão deixa de renovar já.'
                  : 'Seu login é apagado e você sai do negócio. Os atendimentos continuam na agenda. Não dá para desfazer.'}
              </p>
              <Button variant="light" className="conta__delete" onClick={() => navigate(dash('/conta/excluir'))}>
                <Trash2 size={16} aria-hidden="true" /> Excluir minha conta
              </Button>
            </section>
          )}
        </div>
      </div>

      {changingPassword && (
        <ChangePasswordDialog
          onClose={() => setChangingPassword(false)}
          onDone={() => {
            setChangingPassword(false)
            setPasswordChanged(true)
          }}
        />
      )}
      {passwordChanged && <NoticeDialog tone="ok" title="Senha alterada" text="Na próxima vez, entre com a nova senha." onClose={() => setPasswordChanged(false)} />}
      {showDevices && <DevicesDialog onClose={() => setShowDevices(false)} />}
      {resetSent && (
        <NoticeDialog
          tone="ok"
          title="Link enviado"
          text={`Se o e-mail ${email} tiver conta, o link para criar uma nova senha chega em instantes. Olhe também o spam.`}
          onClose={() => setResetSent(false)}
        />
      )}
    </div>
  )
}

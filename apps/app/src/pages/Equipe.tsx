import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Mail, MessageCircle, Plus, UserPlus, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useSubscription } from '../billing/SubscriptionProvider'
import { ConfirmDialog, Modal } from '../components/Modal'
import { Avatar, Button, Card, Em } from '../components/ui'
import { useTeam, type InviteInput, type InviteResult, type TeamInvite, type TeamMember, type TeamProfessional } from '../data/team'
import { inviteUrl } from '../lib/invite'
import { INVITE_ROLES, ROLE_LABEL } from '../lib/permissions'
import { PLANS, canAddProfessional } from '../lib/plans'
import { dash } from '../lib/routes'

type InviteRole = InviteInput['role']

const inviteMessage = (salon: string, token: string) =>
  `Oi! Estou te convidando para a equipe de ${salon} no IKIZY. Crie sua conta (ou entre) por este link para ter acesso à agenda: ${inviteUrl(token)}`

const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

function daysUntil(d: Date) {
  return Math.ceil((d.getTime() - Date.now()) / 864e5)
}

/** botões de copiar o link e mandar pelo WhatsApp */
function ShareInvite({ token, salon }: { token: string; salon: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copie o link do convite:', inviteUrl(token))
    }
  }
  return (
    <div className="team__share">
      <Button variant="light" size="sm" onClick={() => void copy()}>
        <Copy size={14} aria-hidden="true" /> {copied ? 'Link copiado' : 'Copiar link'}
      </Button>
      <a className="btn btn--light btn--sm" href={whatsappLink(inviteMessage(salon, token))} target="_blank" rel="noreferrer">
        <MessageCircle size={14} aria-hidden="true" /> WhatsApp
      </a>
    </div>
  )
}

/** cadastrar ou editar quem atende (aparece na agenda e no site) */
function ProfessionalDialog({
  professional,
  onSave,
  onClose,
}: {
  professional: TeamProfessional | null
  onSave: (name: string, title: string) => Promise<string | null>
  onClose: () => void
}) {
  const [name, setName] = useState(professional?.name ?? '')
  const [title, setTitle] = useState(professional?.title ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const err = await onSave(name, title)
    setBusy(false)
    if (err) return setError(err)
    onClose()
  }

  return (
    <Modal label={professional ? 'Editar profissional' : 'Nova profissional'} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="dialog__head">
          <h2>{professional ? 'Editar profissional' : 'Nova profissional'}</h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="form">
          <label className="field">
            <span className="field__label">Nome</span>
            <span className="input">
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoFocus autoComplete="off" />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Especialidade (opcional)</span>
            <span className="input">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Ex.: Nail designer" autoComplete="off" />
            </span>
          </label>
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button variant="light" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** convite: nome, papel e (para profissional) quem ela é na agenda; depois mostra o link para enviar */
function InviteDialog({
  salon,
  initial,
  professionals,
  canAddPro,
  onCreate,
  onClose,
}: {
  salon: string
  initial: Partial<InviteInput>
  professionals: TeamProfessional[]
  canAddPro: boolean
  onCreate: (input: InviteInput, newProfessional: boolean) => Promise<InviteResult>
  onClose: () => void
}) {
  // profissionais que ainda não têm acesso próprio
  const free = professionals.filter((p) => p.active && !p.userId)
  const [role, setRole] = useState<InviteRole>(initial.role ?? 'professional')
  const [name, setName] = useState(initial.name ?? '')
  const [email, setEmail] = useState('')
  const [emailNote, setEmailNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [proId, setProId] = useState<string | 'new'>(initial.professionalId ?? (free[0]?.id ?? 'new'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const linked = role === 'professional' ? (proId === 'new' ? null : proId) : null
  const needsNew = role === 'professional' && proId === 'new'
  const blocked = needsNew && !canAddPro

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (blocked) return
    setBusy(true)
    setError(null)
    const res = await onCreate({ role, name, professionalId: linked, email }, needsNew)
    setBusy(false)
    if ('error' in res) return setError(res.error)
    if (res.emailSentTo) setEmailNote({ ok: true, text: `Enviamos o convite para ${res.emailSentTo}. Se não chegar, peça para olhar o spam ou mande o link abaixo.` })
    else if (res.emailError) setEmailNote({ ok: false, text: `O convite foi criado, mas o e-mail não saiu: ${res.emailError}` })
    setToken(res.token)
  }

  return (
    <Modal label="Convidar para a equipe" onClose={onClose}>
      <div className="dialog__head">
        <h2>{token ? 'Convite pronto' : 'Convidar para a equipe'}</h2>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      {token ? (
        <div className="form">
          {emailNote && (
            <p className={`billing-note ${emailNote.ok ? 'billing-note--ok' : 'billing-note--error'}`} role="status">
              {emailNote.text}
            </p>
          )}
          <p className="card__sub">
            {emailNote?.ok ? 'Você também pode mandar o link' : 'Mande o link'} para <strong>{name.trim()}</strong>. Ela cria a conta (ou entra) e já cai na
            equipe como {ROLE_LABEL[role].toLowerCase()}. O link vale 7 dias e uma única vez.
          </p>
          <p className="team__link">{inviteUrl(token)}</p>
          <ShareInvite token={token} salon={salon} />
          <div className="dialog__actions">
            <Button onClick={onClose}>Pronto</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="form">
            <label className="field">
              <span className="field__label">Nome de quem você está convidando</span>
              <span className="input">
                <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoFocus autoComplete="off" />
              </span>
            </label>
            <label className="field">
              <span className="field__label">E-mail (opcional)</span>
              <span className="input">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} placeholder="nome@email.com" autoComplete="off" />
              </span>
              <span className="field__hint">Com e-mail, o convite chega na caixa dela. Sem e-mail, você manda o link pelo WhatsApp.</span>
            </label>

            <div className="field">
              <span className="field__label">O que ela vai fazer</span>
              <div className="team__roles" role="radiogroup" aria-label="Papel">
                {INVITE_ROLES.map((r) => (
                  <button key={r.id} type="button" role="radio" aria-checked={role === r.id} className="team__role" onClick={() => setRole(r.id)}>
                    <strong>{r.label}</strong>
                    <span>{r.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {role === 'professional' && (
              <div className="field">
                <span className="field__label">Quem ela é na agenda</span>
                <div className="chips chips--tight" role="radiogroup" aria-label="Profissional na agenda">
                  {free.map((p) => (
                    <button key={p.id} type="button" className="chip" role="radio" aria-checked={proId === p.id} aria-pressed={proId === p.id} onClick={() => setProId(p.id)}>
                      {p.name}
                    </button>
                  ))}
                  <button type="button" className="chip" role="radio" aria-checked={proId === 'new'} aria-pressed={proId === 'new'} onClick={() => setProId('new')}>
                    <Plus size={14} aria-hidden="true" /> Nova na agenda
                  </button>
                </div>
                {blocked && (
                  <p className="field__hint">
                    Seu plano chegou ao limite de profissionais. <Link to={dash('/assinatura')}>Mude de plano</Link> ou escolha alguém que já está na agenda.
                  </p>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="dialog__error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog__actions">
            <Button variant="light" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || blocked}>
              {busy ? 'Criando…' : 'Criar convite'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/** trocar o papel de quem já tem acesso */
function RoleDialog({
  member,
  onSave,
  onClose,
}: {
  member: TeamMember
  onSave: (role: InviteRole) => Promise<string | null>
  onClose: () => void
}) {
  const [role, setRole] = useState<InviteRole>(member.role === 'owner' ? 'manager' : member.role)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    const err = await onSave(role)
    setBusy(false)
    if (err) return setError(err)
    onClose()
  }

  return (
    <Modal label="Mudar papel" onClose={onClose}>
      <div className="dialog__head">
        <h2>O que {member.name ?? 'ela'} faz</h2>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <div className="team__roles" role="radiogroup" aria-label="Papel">
        {INVITE_ROLES.map((r) => (
          <button key={r.id} type="button" role="radio" aria-checked={role === r.id} className="team__role" onClick={() => setRole(r.id)}>
            <strong>{r.label}</strong>
            <span>{r.text}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog__actions">
        <Button variant="light" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </Modal>
  )
}

export default function Equipe() {
  const { salon, displayName } = useAuth()
  const { sub } = useSubscription()
  const team = useTeam()
  const [editing, setEditing] = useState<TeamProfessional | 'new' | null>(null)
  const [inviting, setInviting] = useState<Partial<InviteInput> | null>(null)
  const [roleOf, setRoleOf] = useState<TeamMember | null>(null)
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [resending, setResending] = useState<string | null>(null)

  const resend = async (i: TeamInvite) => {
    setResending(i.id)
    setError(null)
    setNotice(null)
    const err = await team.resendInvite(i.id)
    setResending(null)
    if (err) setError(err)
    else setNotice(`Convite reenviado para ${i.email}.`)
  }

  const salonName = salon?.name ?? 'Studio Maria Beauty'
  const plan = PLANS[sub?.plan ?? 'solo']
  const active = team.professionals.filter((p) => p.active)
  const canAddPro = canAddProfessional(plan.id, active.length)
  const isOwner = team.isOwner

  const run = async (action: () => Promise<string | null>) => {
    setError(null)
    const err = await action()
    if (err) setError(err)
  }

  // "Nova na agenda": cadastra a profissional e liga o convite a ela
  const createInvite = async (input: InviteInput, newProfessional: boolean) => {
    let professionalId = input.professionalId
    if (newProfessional) {
      const res = await team.addProfessional(input.name, '')
      if ('error' in res) return res
      professionalId = res.id
    }
    return team.createInvite({ ...input, professionalId })
  }

  const memberName = (m: TeamMember) =>
    m.userId === team.me ? `${displayName} (você)` : (m.name ?? (m.role === 'owner' ? 'Dona do negócio' : 'Sem nome'))
  const proName = (id: string | null) => team.professionals.find((p) => p.id === id)?.name

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <p className="eyebrow">Equipe</p>
          <h1 className="page__title">
            Sua <Em>equipe</Em>
          </h1>
        </div>
        {isOwner && (
          <div className="page__actions">
            <Button onClick={() => setInviting({})}>
              <UserPlus size={16} aria-hidden="true" /> Convidar pessoa
            </Button>
          </div>
        )}
      </header>

      {team.error && (
        <p className="billing-note billing-note--error" role="alert">
          {team.error}
        </p>
      )}
      {error && (
        <p className="billing-note billing-note--error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="billing-note billing-note--ok" role="status">
          {notice}
        </p>
      )}

      <div className="team">
        <div className="team__col">
        {/* quem atende */}
        <Card className="team__card">
          <div className="card__head">
            <div>
              <h2 className="card__title">Quem atende</h2>
              <p className="card__sub">
                {plan.maxProfessionals === null
                  ? `${active.length} ${active.length === 1 ? 'profissional ativa' : 'profissionais ativas'} · plano ${plan.name} sem limite`
                  : active.length > plan.maxProfessionals
                    ? `${active.length} ativas · o plano ${plan.name} permite ${plan.maxProfessionals}`
                    : `${active.length} de ${plan.maxProfessionals} ${plan.maxProfessionals === 1 ? 'profissional' : 'profissionais'} no plano ${plan.name}`}
              </p>
            </div>
            <Button variant="light" size="sm" disabled={!canAddPro} onClick={() => setEditing('new')}>
              <Plus size={14} aria-hidden="true" /> Nova
            </Button>
          </div>
          {!canAddPro && (
            <p className="team__limit">
              {plan.id === 'solo' ? 'No Solo a agenda é só sua.' : 'Você chegou ao limite do plano.'}{' '}
              {isOwner ? <Link to={dash('/assinatura')}>Mude de plano</Link> : 'Peça para a dona mudar de plano'} para ter mais profissionais. Recepção e
              gerente que não atendem não contam no limite.
            </p>
          )}

          {team.loading ? (
            <p className="card__sub" role="status">
              Carregando…
            </p>
          ) : team.professionals.length === 0 ? (
            <p className="card__sub">Ninguém cadastrado ainda.</p>
          ) : (
            <ul className="team__list">
              {team.professionals.map((p) => (
                <li key={p.id} className={`team__row ${p.active ? '' : 'is-off'}`}>
                  <Avatar name={p.name} size="sm" soft={!p.active} />
                  <div className="team__who">
                    <p className="team__name">{p.name}</p>
                    <p className="team__meta">
                      {[p.title, !p.active ? 'Inativa' : p.userId ? 'Entra com o próprio login' : 'Sem acesso ao sistema'].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="team__actions">
                    {isOwner && p.active && !p.userId && !team.invites.some((i) => i.professionalId === p.id) && (
                      <Button variant="light" size="sm" onClick={() => setInviting({ role: 'professional', name: p.name, professionalId: p.id })}>
                        Dar acesso
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!p.active && !canAddPro}
                      title={!p.active && !canAddPro ? 'O plano chegou ao limite de profissionais' : undefined}
                      onClick={() => void run(() => team.setProfessionalActive(p.id, !p.active))}
                    >
                      {p.active ? 'Desativar' : 'Reativar'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* convites em aberto */}
        {isOwner && team.invites.length > 0 && (
          <Card className="team__card">
            <div className="card__head">
              <div>
                <h2 className="card__title">Convites enviados</h2>
                <p className="card__sub">Aguardando a pessoa aceitar.</p>
              </div>
            </div>
            <ul className="team__list">
              {team.invites.map((i: TeamInvite) => {
                const days = daysUntil(i.expiresAt)
                return (
                  <li key={i.id} className="team__row team__row--invite">
                    <Avatar name={i.name} size="sm" soft />
                    <div className="team__who">
                      <p className="team__name">{i.name}</p>
                      <p className="team__meta">
                        {[ROLE_LABEL[i.role], i.email, proName(i.professionalId) && `agenda de ${proName(i.professionalId)}`, days > 0 ? `vence em ${days} ${days === 1 ? 'dia' : 'dias'}` : 'vencido']
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="team__actions">
                      {days > 0 && i.email && (
                        <Button variant="light" size="sm" disabled={resending === i.id} onClick={() => void resend(i)}>
                          <Mail size={14} aria-hidden="true" /> {resending === i.id ? 'Enviando…' : 'Reenviar e-mail'}
                        </Button>
                      )}
                      {days > 0 && <ShareInvite token={i.token} salon={salonName} />}
                      <Button variant="ghost" size="sm" onClick={() => void run(() => team.cancelInvite(i.id))}>
                        Cancelar
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        </div>

        <div className="team__col">
        {/* quem tem acesso */}
        <Card className="team__card">
          <div className="card__head">
            <div>
              <h2 className="card__title">Quem entra no sistema</h2>
              <p className="card__sub">Cada pessoa usa o próprio login e vê só o que o papel dela permite.</p>
            </div>
          </div>
          <ul className="team__list">
            {team.members.map((m) => (
              <li key={m.userId} className="team__row">
                <Avatar name={m.userId === team.me ? displayName : (m.name ?? '?')} size="sm" />
                <div className="team__who">
                  <p className="team__name">{memberName(m)}</p>
                  <p className="team__meta">{ROLE_LABEL[m.role]}</p>
                </div>
                {isOwner && m.role !== 'owner' && (
                  <div className="team__actions">
                    <Button variant="ghost" size="sm" onClick={() => setRoleOf(m)}>
                      Mudar papel
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                      Tirar acesso
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {/* o que cada papel vê */}
        <Card variant="soft" className="team__card team__help">
          <h2 className="card__title">O que cada papel vê</h2>
          <ul className="team__help-list">
            <li>
              <strong>Dona</strong> tudo, inclusive assinatura e equipe.
            </li>
            {[...INVITE_ROLES].reverse().map((r) => (
              <li key={r.id}>
                <strong>{r.label}</strong> {r.text}
              </li>
            ))}
          </ul>
        </Card>
        </div>
      </div>

      {editing && (
        <ProfessionalDialog
          professional={editing === 'new' ? null : editing}
          onSave={(name, title) => team.saveProfessional(editing === 'new' ? null : editing.id, name, title)}
          onClose={() => setEditing(null)}
        />
      )}
      {inviting && (
        <InviteDialog
          salon={salonName}
          initial={inviting}
          professionals={team.professionals}
          canAddPro={canAddPro}
          onCreate={createInvite}
          onClose={() => setInviting(null)}
        />
      )}
      {roleOf && <RoleDialog member={roleOf} onSave={(role) => team.changeRole(roleOf.userId, role)} onClose={() => setRoleOf(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Tirar o acesso de ${removing.name ?? 'esta pessoa'}?`}
          text="Ela deixa de entrar no sistema do seu negócio. A agenda e o histórico dela continuam salvos."
          confirmLabel="Tirar acesso"
          onConfirm={() => {
            const m = removing
            setRemoving(null)
            void run(() => team.removeMember(m.userId))
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  )
}

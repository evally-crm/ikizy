import { useState, type FormEvent } from 'react'
import { Check, Copy, MessageCircle, Power, UserMinus, X } from 'lucide-react'
import type { ProfessionalInput, TeamInvite, TeamMember, TeamProfessional } from '../../data/team'
import { inviteMessage, invitePath, ROLE_HINT, ROLE_LABEL, type Role } from '../../domain/team'
import { Modal } from '../../components/Modal'
import { Button, Em } from '../../components/ui'

/** cria ou edita quem atende: nome, especialidade e comissão; desativar tira da agenda e do site sem apagar o histórico */
export function ProfessionalDialog({
  professional,
  onSave,
  onToggleActive,
  onClose,
}: {
  professional: TeamProfessional | null
  onSave: (input: ProfessionalInput) => Promise<string | null>
  onToggleActive?: () => Promise<string | null>
  onClose: () => void
}) {
  const [name, setName] = useState(professional?.name ?? '')
  const [title, setTitle] = useState(professional?.title ?? '')
  const [pct, setPct] = useState(professional ? String(professional.commissionPct).replace('.', ',') : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true)
    const message = await action()
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(() => onSave({ name, title, commissionPct: Number(pct.replace(',', '.')) || 0 }))
  }

  return (
    <Modal label={professional ? 'Editar profissional' : 'Nova profissional'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog__head">
          <h2>
            {professional ? 'Editar' : 'Nova'} <Em>profissional</Em>
          </h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="form">
          <label className="field">
            <span className="field__label">Nome</span>
            <span className="input">
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoFocus={!professional} />
            </span>
          </label>
          <div className="form__pair">
            <label className="field">
              <span className="field__label">Especialidade (opcional)</span>
              <span className="input">
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Ex.: Nail designer" />
              </span>
            </label>
            <label className="field">
              <span className="field__label">Comissão (%)</span>
              <span className="input">
                <input value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d,]/g, ''))} inputMode="decimal" placeholder="0" maxLength={6} />
              </span>
              <span className="field__hint">Sobre os atendimentos concluídos dela no mês.</span>
            </label>
          </div>
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          {onToggleActive && professional ? (
            <Button variant="light" disabled={busy} onClick={() => void run(onToggleActive)}>
              <Power size={16} aria-hidden="true" /> {professional.active ? 'Desativar' : 'Reativar'}
            </Button>
          ) : (
            <Button variant="light" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * convite: escolhe o perfil (quando há mais de um), gera o link único e entrega pronto para copiar ou mandar no WhatsApp.
 * Aberto num convite já existente, mostra o link de novo e permite cancelar.
 */
export function InviteDialog({
  roles,
  professional,
  existing,
  salonName,
  onCreate,
  onRevoke,
  onClose,
}: {
  roles: Role[]
  professional: TeamProfessional | null
  existing: TeamInvite | null
  salonName: string
  onCreate: (role: Role) => Promise<{ token: string } | { error: string }>
  onRevoke: (id: string) => Promise<string | null>
  onClose: () => void
}) {
  const [role, setRole] = useState<Role>(existing?.role ?? roles[0] ?? 'professional')
  const [token, setToken] = useState<string | null>(existing?.token ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const url = token ? `${window.location.origin}${invitePath(token)}` : ''
  const message = token ? inviteMessage({ salonName, role, name: professional?.name, url }) : ''

  const create = async () => {
    setBusy(true)
    setError(null)
    const res = await onCreate(role)
    setBusy(false)
    if ('error' in res) setError(res.error)
    else setToken(res.token)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setError('Não deu para copiar. Selecione o link e copie à mão.')
    }
  }
  const revoke = async () => {
    if (!existing) return
    setBusy(true)
    const err = await onRevoke(existing.id)
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <Modal label="Convite de acesso" onClose={onClose}>
      <div className="dialog__head">
        <h2>
          {token ? 'Convite' : 'Dar'} <Em>{token ? 'pronto' : 'acesso'}</Em>
        </h2>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      {!token ? (
        <>
          <p className="dialog__text">
            {professional
              ? `${professional.name} vai entrar com o próprio login e ver só a agenda dela, as clientes dela e os ganhos.`
              : 'Escolha o perfil. A pessoa cria a conta pelo link e já entra no seu negócio.'}
          </p>
          {roles.length > 1 && (
            <div className="invitepick" role="radiogroup" aria-label="Perfil">
              {roles.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} className={`invitepick__opt ${role === r ? 'is-on' : ''}`.trim()} onClick={() => setRole(r)}>
                  <strong>{ROLE_LABEL[r]}</strong>
                  <small>{ROLE_HINT[r]}</small>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="dialog__text">Mande o link para a pessoa. Ele vale 7 dias e só pode ser usado uma vez.</p>
          <div className="invitelink">
            <input readOnly value={url} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
          </div>
        </>
      )}

      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}

      <div className="dialog__actions">
        {!token ? (
          <>
            <Button variant="light" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => void create()} disabled={busy}>
              {busy ? 'Gerando…' : 'Gerar link'}
            </Button>
          </>
        ) : (
          <>
            {existing ? (
              <Button variant="light" onClick={() => void revoke()} disabled={busy}>
                Cancelar convite
              </Button>
            ) : (
              <Button variant="light" onClick={() => void copy()}>
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? 'Copiado' : 'Copiar link'}
              </Button>
            )}
            <a className="btn btn--primary" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              <MessageCircle size={16} aria-hidden="true" /> Enviar no WhatsApp
            </a>
          </>
        )}
      </div>
      {token && existing && (
        <button type="button" className="textlink invitelink__copy" onClick={() => void copy()}>
          {copied ? 'Link copiado' : 'Copiar link'}
        </button>
      )}
    </Modal>
  )
}

/** acesso de alguém da equipe: trocar o perfil ou remover o login (a profissional continua na agenda) */
export function MemberDialog({
  member,
  roles,
  onChangeRole,
  onRemove,
  onClose,
}: {
  member: TeamMember
  roles: Role[]
  onChangeRole: (role: Role) => Promise<string | null>
  onRemove: () => Promise<string | null>
  onClose: () => void
}) {
  const [role, setRole] = useState<Role>(member.role)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true)
    const message = await action()
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal label={`Acesso de ${member.name}`} onClose={onClose}>
      <div className="dialog__head">
        <h2>
          Acesso de <Em>{member.name.split(' ')[0]}</Em>
        </h2>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <p className="dialog__text">{member.email}</p>

      {roles.length > 1 && (
        <div className="invitepick" role="radiogroup" aria-label="Perfil">
          {roles.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={role === r} className={`invitepick__opt ${role === r ? 'is-on' : ''}`.trim()} onClick={() => setRole(r)}>
              <strong>{ROLE_LABEL[r]}</strong>
              <small>{ROLE_HINT[r]}</small>
            </button>
          ))}
        </div>
      )}

      {confirming && (
        <p className="alert" role="alert">
          {member.name} perde o login deste negócio na hora.{member.professionalId ? ' Ela continua na agenda e no histórico.' : ''}
        </p>
      )}
      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}

      <div className="dialog__actions">
        <Button variant="light" disabled={busy} onClick={() => (confirming ? void run(onRemove) : setConfirming(true))}>
          <UserMinus size={16} aria-hidden="true" /> {confirming ? 'Remover mesmo' : 'Remover acesso'}
        </Button>
        {roles.length > 1 ? (
          <Button disabled={busy || role === member.role} onClick={() => void run(() => onChangeRole(role))}>
            {busy ? 'Salvando…' : 'Salvar perfil'}
          </Button>
        ) : (
          <Button onClick={onClose}>Fechar</Button>
        )}
      </div>
    </Modal>
  )
}

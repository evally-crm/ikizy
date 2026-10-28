import { Link } from 'react-router-dom'
import { KeyRound, Plus, UserPlus } from 'lucide-react'
import type { TeamInvite, TeamMember, TeamProfessional } from '../../data/team'
import {
  canManageMember,
  limitMessage,
  membersWithoutAgenda,
  professionalAccess,
  ROLE_LABEL,
  usageLabel,
  type Role,
  type TeamUsage,
} from '../../domain/team'
import { PLANS, type PlanId } from '../../lib/plans'
import { dash } from '../../lib/routes'
import { Avatar, Button, Panel } from '../../components/ui'
import './Team.css'
import { EmptyBunny } from '../../components/BunnyMark'

/**
 * Equipe: quem atende (agenda, comissão) e quem tem login (perfil). No Solo, só o convite para trocar de plano.
 * As decisões (quem pode o quê, limites) chegam prontas do domínio.
 */
export function TeamPanel({
  plan,
  myRole,
  myUserId,
  professionals,
  members,
  invites,
  usage,
  invitable,
  isOwner,
  onNewProfessional,
  onEditProfessional,
  onInvite,
  onInviteStaff,
  onShowInvite,
  onManageMember,
}: {
  plan: PlanId
  myRole: Role
  myUserId: string | null
  professionals: TeamProfessional[]
  members: TeamMember[]
  invites: TeamInvite[]
  usage: TeamUsage
  invitable: Role[]
  isOwner: boolean
  onNewProfessional: () => void
  onEditProfessional: (p: TeamProfessional) => void
  onInvite: (p: TeamProfessional) => void
  onInviteStaff: () => void
  onShowInvite: (invite: TeamInvite) => void
  onManageMember: (m: TeamMember) => void
}) {
  const active = professionals.filter((p) => p.active)
  const inactive = professionals.filter((p) => !p.active)
  const staff = membersWithoutAgenda(members, professionals).filter((m) => m.role !== 'owner')
  const staffInvites = invites.filter((i) => !i.professionalId)
  const canInviteStaff = invitable.some((r) => r !== 'professional')

  if (plan === 'solo') {
    return (
      <section className="team__upsell">
        <span className="team__kicker">Plano Solo</span>
        <h2 className="team__headline">Sua equipe cabe no {PLANS.studio.name}</h2>
        <p className="team__text">
          No Solo a agenda é só sua. No {PLANS.studio.name} entram até 3 profissionais, cada uma com o próprio login para ver a agenda dela pelo celular, e a
          comissão de cada uma no Financeiro. No {PLANS.salao.name}, sem limite e com gerente e recepção.
        </p>
        {isOwner && (
          <Link to={dash('/assinatura')} className="btn btn--primary">
            Ver planos
          </Link>
        )}
      </section>
    )
  }

  return (
    <div className="team">
      <div className="team__usage">
        <div className="team__meter">
          <span className="team__kicker">Profissionais</span>
          <strong>{usageLabel(usage.professionals)}</strong>
          <small>ativas na agenda</small>
        </div>
        <div className="team__meter">
          <span className="team__kicker">Acessos</span>
          <strong>{usageLabel(usage.access)}</strong>
          <small>com login, contando você e convites</small>
        </div>
        <div className="team__meter team__meter--plan">
          <span className="team__label">Plano {PLANS[plan].name}</span>
          <small>{usage.professionals.full || usage.access.full ? limitMessage(plan, usage.professionals.full ? 'professionals' : 'access') : 'Ainda cabe mais gente na equipe.'}</small>
          {isOwner && (usage.professionals.full || usage.access.full) && plan !== 'salao' && (
            <Link to={dash('/assinatura')} className="team__link">
              Ver planos
            </Link>
          )}
        </div>
      </div>

      <Panel
        title="Quem atende"
        eyebrow="Aparecem na agenda e no site. A comissão entra no Financeiro."
        action={
          <Button size="sm" onClick={onNewProfessional} disabled={usage.professionals.full}>
            <Plus size={16} aria-hidden="true" /> Nova profissional
          </Button>
        }
      >
        <ul className="team__list">
          {active.map((p) => {
            const access = professionalAccess(p, members, invites)
            const invite = access.kind === 'invite' ? invites.find((i) => i.id === access.inviteId) : undefined
            const member = access.kind === 'member' ? members.find((m) => m.userId === p.userId) : undefined
            return (
              <li key={p.id} className="team__row">
                <Avatar name={p.name} />
                <button type="button" className="team__who" onClick={() => onEditProfessional(p)}>
                  <strong>{p.name}</strong>
                  <small>
                    {p.title || 'Sem especialidade'} · comissão {p.commissionPct}%
                  </small>
                </button>
                <span className="team__access">
                  {access.kind === 'member' && <span className="team__chip team__chip--on">{ROLE_LABEL[access.role]}</span>}
                  {access.kind === 'invite' && <span className="team__chip">{access.label}</span>}
                  {access.kind === 'none' && <span className="team__chip team__chip--off">Sem login</span>}
                </span>
                <span className="team__actions">
                  {access.kind === 'none' && invitable.includes('professional') && (
                    <Button size="sm" onClick={() => onInvite(p)} disabled={usage.access.full}>
                      <KeyRound size={15} aria-hidden="true" /> Dar acesso
                    </Button>
                  )}
                  {invite && (
                    <Button size="sm" variant="ghost" onClick={() => onShowInvite(invite)}>
                      Ver convite
                    </Button>
                  )}
                  {member && canManageMember(myRole, member.role, member.userId === myUserId) && (
                    <Button size="sm" variant="ghost" onClick={() => onManageMember(member)}>
                      Acesso
                    </Button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        {inactive.length > 0 && (
          <>
            <p className="panel__note">Desativadas (saíram da agenda e do site; o histórico continua)</p>
            <ul className="team__list team__list--muted">
              {inactive.map((p) => (
                <li key={p.id} className="team__row">
                  <Avatar name={p.name} soft />
                  <button type="button" className="team__who" onClick={() => onEditProfessional(p)}>
                    <strong>{p.name}</strong>
                    <small>{p.title || 'Sem especialidade'}</small>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {(canInviteStaff || staff.length > 0 || staffInvites.length > 0) && (
        <Panel
          title="Recepção e gerência"
          eyebrow="Acessos que não atendem: veem a agenda de todas, sem aparecer nela."
          action={
            canInviteStaff ? (
              <Button size="sm" onClick={onInviteStaff} disabled={usage.access.full}>
                <UserPlus size={16} aria-hidden="true" /> Convidar
              </Button>
            ) : null
          }
        >
          <ul className="team__list">
            {staff.map((m) => (
                <li key={m.userId} className="team__row">
                  <Avatar name={m.name} />
                  <span className="team__who team__who--static">
                    <strong>{m.name}</strong>
                    <small>{m.email}</small>
                  </span>
                  <span className="team__access">
                    <span className="team__chip team__chip--on">{ROLE_LABEL[m.role]}</span>
                  </span>
                  <span className="team__actions">
                    {canManageMember(myRole, m.role, m.userId === myUserId) && (
                      <Button size="sm" variant="ghost" onClick={() => onManageMember(m)}>
                        Acesso
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            {staffInvites.map((i) => (
              <li key={i.id} className="team__row">
                <Avatar name={ROLE_LABEL[i.role]} soft />
                <span className="team__who team__who--static">
                  <strong>Convite para {ROLE_LABEL[i.role].toLowerCase()}</strong>
                  <small>Ainda não aceito</small>
                </span>
                <span className="team__access">
                  <span className="team__chip">Convite enviado</span>
                </span>
                <span className="team__actions">
                  <Button size="sm" variant="ghost" onClick={() => onShowInvite(i)}>
                    Ver convite
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          {staff.length === 0 && staffInvites.length === 0 && (
            <p className="panel__empty panel__empty--bunny">
              <EmptyBunny />
              Ninguém por aqui ainda.
            </p>
          )}
        </Panel>
      )}
    </div>
  )
}

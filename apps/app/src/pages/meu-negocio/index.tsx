import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useAgenda } from '../../data/AgendaProvider'
import { useBusiness } from '../../data/business'
import { useTeam, type TeamInvite, type TeamMember, type TeamProfessional } from '../../data/team'
import { assignableRoles, invitableRoles, teamUsage, type Role } from '../../domain/team'
import type { Product, Service } from '../../data/catalog'
import { openStatus, summarizeBusiness, summarizeHours } from '../../domain/business'
import { ConfirmDialog } from '../../components/Modal'
import { WorkingHoursDialog } from '../../components/WorkingHoursDialog'
import { Em, PageHeader, StatTile, Tabs } from '../../components/ui'
import { formatBRL } from '../../lib/format'
import { DetailsPanel } from './DetailsPanel'
import { HoursPanel } from './HoursPanel'
import { MaterialsPanel } from './MaterialsPanel'
import { ProductDialog } from './ProductDialog'
import { ServiceDialog } from './ServiceDialog'
import { ServicesPanel } from './ServicesPanel'
import { TeamPanel } from './TeamPanel'
import { InviteDialog, MemberDialog, ProfessionalDialog } from './TeamDialogs'
import './MeuNegocio.css'
import { PageLoader } from '../../components/PageLoader'

const TABS = [
  { id: 'dados', label: 'Dados' },
  { id: 'horario', label: 'Horário' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'custos', label: 'Materiais' },
  { id: 'equipe', label: 'Equipe' },
] as const
type TabId = (typeof TABS)[number]['id']

/** /dashboard/negocio: tudo que é do negócio (dados, horário, serviços, materiais), uma seção por vez em abas */
export default function MeuNegocio() {
  const { salon } = useAuth()
  const { professionals, workingHours, reload: reloadAgenda } = useAgenda()
  const biz = useBusiness()
  const team = useTeam()
  const { hash, state } = useLocation()
  const navigate = useNavigate()
  const canManage = !salon || salon.role === 'owner' || salon.role === 'manager'
  // a aba fica no endereço (#servicos): os atalhos dos primeiros passos e o voltar do navegador funcionam
  const tab: TabId = TABS.find((t) => hash === '#' + t.id)?.id ?? 'dados'

  const [editingHours, setEditingHours] = useState(false)
  const [service, setService] = useState<Service | 'new' | null>(null)
  const [product, setProduct] = useState<Product | 'new' | null>(null)
  const [removing, setRemoving] = useState<{ kind: 'service' | 'product'; id: string; name: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pro, setPro] = useState<TeamProfessional | 'new' | null>(null)
  const [inviting, setInviting] = useState<{ professional: TeamProfessional | null; existing: TeamInvite | null } | null>(null)
  const [member, setMember] = useState<TeamMember | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // vindo dos primeiros passos (#horario), já abre a edição do horário; trocar de aba pelo menu não abre
  useEffect(() => {
    if (biz.loading || hash !== '#horario' || !canManage) return
    if (!(state as { tab?: boolean } | null)?.tab) setEditingHours(true)
  }, [hash, state, biz.loading, canManage])

  const myRole: Role = salon?.role ?? 'owner'
  const usage = useMemo(
    () =>
      teamUsage(team.plan, {
        activeProfessionals: team.professionals.filter((p) => p.active).length,
        members: team.members.length,
        openInvites: team.invites.length,
      }),
    [team.plan, team.professionals, team.members, team.invites],
  )
  const invitable = invitableRoles(myRole, team.plan)
  // mexeu na equipe: a agenda (colunas, nomes) e a lista da equipe recarregam
  const afterTeam = (message: string | null, ok: string) => {
    if (!message) {
      reloadAgenda()
      setToast(ok)
    }
    return message
  }

  const summary = useMemo(() => summarizeBusiness(biz.services, biz.products), [biz.services, biz.products])
  const allHours = useMemo(() => professionals.flatMap((p) => workingHours[p.id] ?? []), [professionals, workingHours])
  const [now] = useState(() => new Date())
  const status = useMemo(() => openStatus(allHours, now), [allHours, now])
  const weekText = summarizeHours(allHours)[0] ?? 'Horário ainda não definido'

  // a agenda guarda a lista de serviços para marcar horário: atualiza depois de mexer aqui
  const afterServices = (message: string | null, ok: string) => {
    if (!message) {
      reloadAgenda()
      setToast(ok)
    }
    return message
  }

  const confirmRemoval = async () => {
    if (!removing) return
    const r = removing
    setRemoving(null)
    setService(null)
    setProduct(null)
    const message = r.kind === 'service' ? afterServices(await biz.removeService(r.id), 'Serviço apagado') : await biz.removeProduct(r.id)
    if (message) setToast(message)
    else if (r.kind === 'product') setToast('Material apagado')
  }

  return (
    <div className="page bizpage">
      <PageHeader
        title={
          <>
            Seu <Em>negócio</Em>
          </>
        }
        crumb={weekText}
        actions={
          <Tabs
            label="Seções do negócio"
            value={tab}
            onChange={(id: TabId) => navigate({ hash: '#' + id }, { replace: true, state: { tab: true } })}
            items={TABS.map((t) => ({
              id: t.id,
              label: t.label,
              badge:
                t.id === 'servicos'
                  ? summary.serviceCount || null
                  : t.id === 'custos'
                    ? biz.products.length || null
                    : t.id === 'equipe'
                      ? team.professionals.filter((p) => p.active).length || null
                      : null,
            }))}
          />
        }
      />

      {biz.error && (
        <p className="dialog__error" role="alert">
          {biz.error}{' '}
          <button type="button" className="textlink" onClick={biz.reload}>
            Tentar de novo
          </button>
        </p>
      )}
      {!canManage && <p className="alert">Só a dona ou a gerente alteram os dados do negócio. Você pode consultar.</p>}

      {biz.loading ? (
        <PageLoader label="Carregando os dados do negócio…" />
      ) : (
        <>
          <div className="biztiles">
            <StatTile
              label="Serviços"
              value={summary.serviceCount}
              hint={summary.unpriced > 0 ? `${summary.unpriced} ${summary.unpriced === 1 ? 'sem preço' : 'sem preço'}` : 'Todos com preço'}
            />
            <StatTile
              label="Sobra média"
              value={summary.averageMarginPct === null ? '–' : `${summary.averageMarginPct}%`}
              hint={summary.averageMarginPct === null ? 'Ligue um material a um serviço' : 'dos serviços com material'}
            />
            <StatTile label="Material por mês" value={formatBRL(summary.materialSpend).replace(',00', '')} hint={`${biz.products.length} materiais`} />
            <StatTile label="Equipe" value={professionals.length} hint={status.open ? 'Aberto agora' : 'Fechado agora'} />
          </div>

          {tab === 'dados' && <DetailsPanel details={biz.details} canManage={canManage} status={status} onSave={biz.saveDetails} />}
          {tab === 'horario' && (
            <HoursPanel professionals={professionals} workingHours={workingHours} canManage={canManage} onEdit={() => setEditingHours(true)} />
          )}
          {tab === 'servicos' && (
            <ServicesPanel services={biz.services} products={biz.products} canManage={canManage} onNew={() => setService('new')} onOpen={setService} />
          )}
          {tab === 'equipe' &&
            (team.loading ? (
              <PageLoader label="Carregando a equipe…" />
            ) : team.error ? (
              <p className="dialog__error" role="alert">
                {team.error}{' '}
                <button type="button" className="textlink" onClick={team.reload}>
                  Tentar de novo
                </button>
              </p>
            ) : (
              <TeamPanel
                plan={team.plan}
                myRole={myRole}
                myUserId={team.myUserId}
                professionals={team.professionals}
                members={team.members}
                invites={team.invites}
                usage={usage}
                invitable={invitable}
                isOwner={myRole === 'owner'}
                onNewProfessional={() => setPro('new')}
                onEditProfessional={setPro}
                onInvite={(p) => setInviting({ professional: p, existing: null })}
                onInviteStaff={() => setInviting({ professional: null, existing: null })}
                onShowInvite={(i) => setInviting({ professional: team.professionals.find((p) => p.id === i.professionalId) ?? null, existing: i })}
                onManageMember={setMember}
              />
            ))}
          {tab === 'custos' && (
            <MaterialsPanel
              products={biz.products}
              services={biz.services}
              total={summary.materialSpend}
              canManage={canManage}
              onNew={() => setProduct('new')}
              onOpen={setProduct}
            />
          )}
        </>
      )}

      {editingHours && <WorkingHoursDialog onClose={() => setEditingHours(false)} notify={setToast} />}
      {service && (
        <ServiceDialog
          service={service === 'new' ? null : service}
          products={biz.products}
          onClose={() => setService(null)}
          onSave={async (input) =>
            afterServices(await biz.saveService(input, service === 'new' ? undefined : service.id), service === 'new' ? 'Serviço criado' : 'Serviço salvo')
          }
          onRemove={service === 'new' ? undefined : () => setRemoving({ kind: 'service', id: service.id, name: service.name })}
        />
      )}
      {product && (
        <ProductDialog
          product={product === 'new' ? null : product}
          onClose={() => setProduct(null)}
          onSave={async (input) => {
            const message = await biz.saveProduct(input, product === 'new' ? undefined : product.id)
            if (!message) setToast('Material salvo')
            return message
          }}
          onRemove={product === 'new' ? undefined : () => setRemoving({ kind: 'product', id: product.id, name: product.name })}
        />
      )}
      {pro && (
        <ProfessionalDialog
          professional={pro === 'new' ? null : pro}
          onClose={() => setPro(null)}
          onSave={async (input) => afterTeam(await team.saveProfessional(input, pro === 'new' ? undefined : pro.id), pro === 'new' ? 'Profissional cadastrada' : 'Profissional salva')}
          onToggleActive={
            pro === 'new' ? undefined : async () => afterTeam(await team.setActive(pro.id, !pro.active), pro.active ? 'Profissional desativada' : 'Profissional reativada')
          }
        />
      )}
      {inviting && (
        <InviteDialog
          roles={inviting.professional ? ['professional'] : invitable.filter((r) => r !== 'professional')}
          professional={inviting.professional}
          existing={inviting.existing}
          salonName={salon?.name ?? 'seu negócio'}
          onCreate={(role) => team.invite(role, inviting.professional?.id ?? null)}
          onRevoke={async (id) => afterTeam(await team.revokeInvite(id), 'Convite cancelado')}
          onClose={() => setInviting(null)}
        />
      )}
      {member && (
        <MemberDialog
          member={member}
          roles={assignableRoles(myRole, team.plan, Boolean(member.professionalId))}
          onChangeRole={async (role) => afterTeam(await team.changeRole(member.userId, role), 'Perfil alterado')}
          onRemove={async () => afterTeam(await team.removeAccess(member.userId), 'Acesso removido')}
          onClose={() => setMember(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Apagar ${removing.name}?`}
          text={
            removing.kind === 'service'
              ? 'O serviço sai da agenda e do site. Os atendimentos já feitos continuam no histórico com o nome dele.'
              : 'Os serviços que usavam este material ficam sem custo de material.'
          }
          confirmLabel="Apagar"
          onClose={() => setRemoving(null)}
          onConfirm={() => void confirmRemoval()}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

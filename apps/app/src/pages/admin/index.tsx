import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { DeleteAccountDialog } from '../../components/DeleteAccountDialog'
import { NoticeDialog } from '../../components/Modal'
import { PageLoader } from '../../components/PageLoader'
import { Button, Em, PageHeader } from '../../components/ui'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { SearchField } from '../../components/ui/SearchField'
import { StatTile } from '../../components/ui/StatTile'
import { adminDeleteSalon, adminLog, adminSalons, type AdminSalon, type AuditRow } from '../../lib/accountApi'
import { BillingError } from '../../lib/billingApi'
import { isPlanId, PLANS } from '../../lib/plans'
import { ROUTES } from '../../lib/routes'
import './Admin.css'

const STATUS: Record<string, { label: string; tone: string }> = {
  trialing: { label: 'Teste', tone: 'warning' },
  active: { label: 'Pagando', tone: 'success' },
  past_due: { label: 'Atrasado', tone: 'danger' },
  canceled: { label: 'Cancelado', tone: 'neutral' },
}

/** o que cada linha do registro quer dizer, em português */
function actionLabel(r: AuditRow): string {
  switch (r.action) {
    case 'admin.delete_salon':
      return 'Master apagou o negócio'
    case 'owner.request_deletion':
      return 'Dona pediu a exclusão (7 dias)'
    case 'owner.cancel_deletion':
      return 'Dona desistiu da exclusão'
    case 'system.purge_salon':
      return r.details.reason === 'retention' ? 'Apagado: 90 dias sem acesso' : 'Apagado: exclusão pedida venceu'
    case 'system.purge_orphan_logins':
      return `Logins largados apagados (${String(r.details.count ?? 0)})`
    default:
      return r.action
  }
}
const who = (r: AuditRow) => (r.actorKind === 'system' ? 'Automático' : (r.actorEmail ?? r.actorKind))
const stamp = (iso: string) => format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: ptBR })

const day = (iso: string) => format(new Date(iso), 'dd/MM/yyyy', { locale: ptBR })
const planName = (plan: string | null) => (plan && isPlanId(plan) ? PLANS[plan].name : '—')

/** /dashboard/admin: acesso master da IKIZY — todos os negócios, com plano, uso e o botão de apagar */
export default function Admin() {
  const { isAdmin, adminChecked } = useAuth()
  const [salons, setSalons] = useState<AdminSalon[] | null>(null)
  const [log, setLog] = useState<AuditRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<AdminSalon | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setSalons(await adminSalons())
      setError(null)
      // o registro é um extra: se falhar, a lista de negócios continua valendo
      setLog(await adminLog().catch(() => []))
    } catch (e) {
      setError(e instanceof BillingError ? e.message : 'Não foi possível carregar os negócios.')
      setSalons([])
    }
  }, [])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!salons || !q) return salons ?? []
    return salons.filter((s) => [s.name, s.slug, s.ownerEmail, s.ownerName].some((v) => v?.toLowerCase().includes(q)))
  }, [salons, query])

  // o servidor é quem decide: espera a resposta antes de mandar embora quem não é master
  if (!adminChecked) return <PageLoader label="Conferindo o acesso…" />
  if (!isAdmin) return <Navigate to={ROUTES.dashboard} replace />

  const count = (st: string) => salons?.filter((s) => s.status === st).length ?? 0

  const columns: Column<AdminSalon>[] = [
    {
      key: 'name',
      label: 'Negócio',
      render: (s) => (
        <span className="admin__who">
          <strong>{s.name}</strong>
          <small>{s.slug}.ikizy.com</small>
        </span>
      ),
    },
    {
      key: 'owner',
      label: 'Dona',
      hideOnMobile: true,
      render: (s) => (
        <span className="admin__who">
          <strong>{s.ownerName ?? '—'}</strong>
          <small>{s.ownerEmail ?? 'sem login'}</small>
        </span>
      ),
    },
    {
      key: 'plan',
      label: 'Plano',
      render: (s) => {
        const st = s.status ? STATUS[s.status] : null
        return (
          <span className="admin__who">
            <strong>{planName(s.plan)}</strong>
            {st && <span className={`badge badge--${st.tone}`}>{st.label}</span>}
            {s.deletionScheduledAt && <span className="badge badge--danger">Exclusão em {format(new Date(s.deletionScheduledAt), 'dd/MM', { locale: ptBR })}</span>}
          </span>
        )
      },
    },
    { key: 'clients', label: 'Clientes', align: 'right', hideOnMobile: true, render: (s) => s.clients },
    { key: 'appts', label: 'Atendimentos', align: 'right', hideOnMobile: true, render: (s) => s.appointments },
    { key: 'created', label: 'Desde', hideOnMobile: true, render: (s) => day(s.createdAt) },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (s) => (
        <Button variant="ghost" size="sm" icon aria-label={`Apagar ${s.name}`} onClick={() => setTarget(s)}>
          <Trash2 size={16} />
        </Button>
      ),
    },
  ]

  const logColumns: Column<AuditRow>[] = [
    { key: 'at', label: 'Quando', render: (r) => stamp(r.at) },
    { key: 'what', label: 'O que aconteceu', render: (r) => actionLabel(r) },
    {
      key: 'salon',
      label: 'Negócio',
      hideOnMobile: true,
      render: (r) =>
        r.salonName ? (
          <span className="admin__who">
            <strong>{r.salonName}</strong>
            <small>{r.salonSlug}.ikizy.com</small>
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'who', label: 'Quem', hideOnMobile: true, render: (r) => <small>{who(r)}</small> },
  ]

  return (
    <div className="page admin">
      <PageHeader
        title={
          <>
            Acesso <Em>master</Em>
          </>
        }
        crumb="Todos os negócios da IKIZY"
      />

      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}

      {salons === null ? (
        <PageLoader label="Carregando os negócios…" />
      ) : (
        <>
          <div className="admin__stats">
            <StatTile label="Negócios" value={salons.length} tone="dark" />
            <StatTile label="Em teste" value={count('trialing')} />
            <StatTile label="Pagando" value={count('active')} />
            <StatTile label="Atrasados ou cancelados" value={count('past_due') + count('canceled')} />
          </div>

          <SearchField value={query} onChange={setQuery} label="Buscar negócio" placeholder="Buscar por nome, endereço ou e-mail" />

          <DataTable caption="Negócios" columns={columns} rows={rows} rowKey={(s) => s.id} empty={<p>Nenhum negócio encontrado.</p>} />

          <h2 className="admin__title">Registro de ações</h2>
          <p className="admin__hint">Quem apagou ou pediu para apagar o quê, e as limpezas automáticas. Os últimos 100 registros.</p>
          <DataTable
            caption="Registro de ações"
            columns={logColumns}
            rows={log}
            rowKey={(r) => String(r.id)}
            empty={<p>Nenhuma ação registrada ainda.</p>}
          />
        </>
      )}

      {target && (
        <DeleteAccountDialog
          title={`Apagar ${target.name}?`}
          text={`Apaga de vez o negócio, as clientes, a agenda, o caixa, as fotos, o site e o login da dona${
            target.ownerEmail ? ` (${target.ownerEmail})` : ''
          }. A assinatura no Stripe é cancelada na hora. Não dá para desfazer.`}
          expected={target.slug}
          confirmLabel="Apagar negócio"
          onDelete={async (typed) => {
            try {
              await adminDeleteSalon(target.id, typed)
            } catch (e) {
              return e instanceof BillingError ? e.message : 'Não foi possível apagar agora.'
            }
            setDone(target.name)
            setTarget(null)
            void load()
            return null
          }}
          onClose={() => setTarget(null)}
        />
      )}
      {done && <NoticeDialog tone="ok" title="Negócio apagado" text={`${done} e o login da dona foram apagados.`} onClose={() => setDone(null)} />}
    </div>
  )
}

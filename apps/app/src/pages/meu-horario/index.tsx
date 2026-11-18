import { useAuth } from '../../auth/AuthProvider'
import { useAgenda } from '../../data/AgendaProvider'
import { hoursSpan, summarizeHours, weekDays } from '../../domain/business'
import { servicesOf } from '../../domain/team'
import { WeekGrid } from '../../components/business/WeekGrid'
import { DataTable, Em, PageHeader, Panel, type Column } from '../../components/ui'
import { PageLoader } from '../../components/PageLoader'
import { formatDuration } from '../../lib/agendaTime'
import { formatBRL } from '../../lib/format'

type Svc = ReturnType<typeof useAgenda>['services'][number]

/**
 * /dashboard/meu-horario: a profissional vê os dias, as horas e os serviços dela, sem editar.
 * Tudo vem do que a agenda já carrega (o banco deixa todo membro ler horários e "quem faz");
 * quem muda é a dona ou a gerente, em Meu negócio.
 */
export default function MeuHorario() {
  const { salon, displayName } = useAuth()
  const { loading, error, professionals, services, workingHours } = useAgenda()
  const proId = salon?.professionalId ?? null
  const me = professionals.find((p) => p.id === proId)
  const hours = proId ? workingHours[proId] : undefined
  const mine = proId ? servicesOf(proId, services) : []
  const summary = summarizeHours(hours)

  const columns: Column<Svc>[] = [
    { key: 'name', label: 'Serviço', render: (s) => <strong>{s.name}</strong> },
    { key: 'duration', label: 'Duração', render: (s) => formatDuration(s.duration) },
    { key: 'price', label: 'Preço', align: 'right', render: (s) => (s.price > 0 ? formatBRL(s.price).replace(',00', '') : '–') },
  ]

  return (
    <div className="page">
      <PageHeader
        title={
          <>
            Meu <Em>horário</Em>
          </>
        }
        crumb={`${(me?.name ?? displayName).split(' ')[0]}, quando você atende e o que faz`}
      />

      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}

      {!proId ? (
        <Panel title="Seu acesso ainda não está ligado à agenda">
          <p className="panel__empty">Peça para a dona do negócio ligar você a quem atende, em Meu negócio → Equipe.</p>
        </Panel>
      ) : loading ? (
        <PageLoader label="Carregando seu horário…" />
      ) : (
        <>
          <Panel title="Dias e horários" eyebrow={summary.length ? summary.join(' · ') : 'Ainda sem horário: o site não oferece vagas com você'}>
            <WeekGrid rows={[{ id: proId, name: me?.name ?? 'Você', days: weekDays(hours), summary }]} span={hoursSpan([hours])} />
          </Panel>

          <Panel title="Serviços que você faz" eyebrow={`${mine.length} ${mine.length === 1 ? 'serviço' : 'serviços'} · as clientes só agendam estes com você`}>
            <DataTable caption="Serviços que você faz" columns={columns} rows={mine} rowKey={(s) => s.id} empty="Nenhum serviço ligado a você ainda." />
          </Panel>

          <p className="panel__empty">Quem muda o horário e os serviços é a dona do negócio. Precisa trocar um dia ou incluir um serviço? Fale com ela.</p>
        </>
      )}
    </div>
  )
}

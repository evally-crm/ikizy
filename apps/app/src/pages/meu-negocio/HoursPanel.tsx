import { hoursSpan, summarizeHours, weekDays, type OpenStatus } from '../../domain/business'
import { formatTime } from '../../lib/format'
import type { HourInterval } from '../../lib/agendaTime'
import { WeekGrid } from '../../components/business/WeekGrid'
import { Button, Panel } from '../../components/ui'

/** horário de atendimento de cada profissional, desenhado na semana */
export function HoursPanel({
  professionals,
  workingHours,
  status,
  canManage,
  onEdit,
}: {
  professionals: { id: string; name: string }[]
  workingHours: Record<string, HourInterval[]>
  /** aberto ou fechado agora; null quando ninguém tem horário */
  status: OpenStatus | null
  canManage: boolean
  onEdit: () => void
}) {
  const span = hoursSpan(professionals.map((p) => workingHours[p.id]))
  const rows = professionals.map((p) => ({
    id: p.id,
    name: p.name,
    days: weekDays(workingHours[p.id]),
    summary: summarizeHours(workingHours[p.id]),
  }))
  return (
    <Panel
      title="Horário"
      action={
        canManage && professionals.length > 0 ? (
          <Button size="sm" onClick={onEdit}>
            Editar
          </Button>
        ) : null
      }
    >
      {status && (
        <p className="panel__note">
          <span className={`badge badge--soft ${status.open ? 'badge--success' : 'badge--neutral'}`}>
            {status.open
              ? `Aberto agora · fecha às ${formatTime(status.until)}`
              : status.opensAt !== null
                ? `Fechado agora · abre às ${formatTime(status.opensAt)}`
                : 'Fechado agora'}
          </span>
        </p>
      )}
      {professionals.length === 0 ? <p className="panel__empty">Cadastre quem atende na agenda para definir o horário.</p> : <WeekGrid rows={rows} span={span} />}
      <p className="panel__note">O site só oferece horários dentro destes. Na agenda, o resto aparece hachurado.</p>
    </Panel>
  )
}

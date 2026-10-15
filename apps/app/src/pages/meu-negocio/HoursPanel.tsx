import { hoursSpan, summarizeHours, weekDays } from '../../domain/business'
import type { HourInterval } from '../../lib/agendaTime'
import { WeekGrid } from '../../components/business/WeekGrid'
import { Button, Panel } from '../../components/ui'

/** horário de atendimento de cada profissional, desenhado na semana */
export function HoursPanel({
  professionals,
  workingHours,
  canManage,
  onEdit,
}: {
  professionals: { id: string; name: string }[]
  workingHours: Record<string, HourInterval[]>
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
      title="Horário de atendimento"
      eyebrow="O site só oferece horários dentro dele; a agenda mostra o resto hachurado"
      action={
        canManage && professionals.length > 0 ? (
          <Button size="sm" onClick={onEdit}>
            Editar horário
          </Button>
        ) : null
      }
    >
      {professionals.length === 0 ? <p className="panel__empty">Cadastre quem atende na agenda para definir o horário.</p> : <WeekGrid rows={rows} span={span} />}
    </Panel>
  )
}

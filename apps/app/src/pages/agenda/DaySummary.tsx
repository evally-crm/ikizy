import type { DaySummary as DaySummaryData } from '../../domain/agenda'
import { formatBRL, formatTime } from '../../lib/format'
import { StatTile } from '../../components/ui'
import type { Appointment } from '../../types'
import './DaySummary.css'

/** faixa de números do dia: atendimentos, previsto, pedidos e o próximo atendimento */
export function DaySummary({
  summary,
  isToday,
  professionalName,
}: {
  summary: DaySummaryData<Appointment>
  isToday: boolean
  professionalName: (id: string) => string
}) {
  const { next } = summary
  return (
    <div className="daysummary">
      <StatTile
        label="Atendimentos"
        value={summary.count}
        hint={summary.concluded > 0 ? `${summary.concluded} ${summary.concluded === 1 ? 'concluído' : 'concluídos'}` : 'Nenhum concluído ainda'}
      />
      <StatTile label="Previsto no dia" value={formatBRL(summary.expected).replace(',00', '')} hint="Sem as faltas" />
      <StatTile
        label="Pedidos para confirmar"
        value={summary.awaiting}
        hint={summary.awaiting > 0 ? 'Aguardando a sua resposta' : 'Nada pendente'}
        tone={summary.awaiting > 0 ? 'brand' : 'default'}
      />
      <StatTile
        label={isToday ? 'Próximo atendimento' : 'Primeiro do dia'}
        value={next ? formatTime(next.start) : '–'}
        hint={next ? `${next.client} · ${professionalName(next.professionalId)}` : isToday ? 'Nenhum por vir hoje' : 'Dia sem atendimentos'}
      />
    </div>
  )
}

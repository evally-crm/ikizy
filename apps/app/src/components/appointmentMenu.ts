import { CalendarClock, CheckCheck, CircleCheck, CircleDashed, CircleX, Copy, MessageCircle, Play, UserRound, UserX } from 'lucide-react'
import type { MenuEntry } from './ContextMenu'
import type { Appointment, AppointmentStatus, Professional } from '../types'

export interface AppointmentActions {
  status: (status: AppointmentStatus) => void
  professional: (professionalId: string) => void
  reschedule: () => void
  whatsapp: () => void
  duplicate: () => void
  fault: () => void
  cancel: () => void
}

const STATUSES = [
  { value: 'pendente', label: 'Aguardando', hint: '1', icon: CircleDashed },
  { value: 'confirmado', label: 'Confirmado', hint: '2', icon: CircleCheck },
  { value: 'atendimento', label: 'Em atendimento', hint: '3', icon: Play },
  { value: 'concluido', label: 'Concluído', hint: '4', icon: CheckCheck },
] as const

/** itens do botão direito sobre um atendimento */
export function appointmentEntries(
  a: Appointment,
  professionals: Professional[],
  actions: AppointmentActions,
  hasPhone: boolean,
): MenuEntry[] {
  const closed = a.status === 'cancelado' || a.status === 'faltou'
  return [
    {
      kind: 'item',
      label: 'Status',
      hint: 'S',
      icon: CircleCheck,
      children: STATUSES.map((s) => ({
        kind: 'item' as const,
        label: s.label,
        hint: s.hint,
        icon: s.icon,
        checked: a.status === s.value,
        onSelect: () => actions.status(s.value),
      })),
    },
    {
      kind: 'item',
      label: 'Profissional',
      hint: 'P',
      icon: UserRound,
      disabled: professionals.length < 2,
      children: professionals.map((p) => ({
        kind: 'item' as const,
        label: p.name,
        checked: p.id === a.professionalId,
        onSelect: () => actions.professional(p.id),
      })),
    },
    { kind: 'item', label: 'Remarcar…', hint: 'R', icon: CalendarClock, onSelect: actions.reschedule },
    { kind: 'item', label: 'Duplicar', hint: 'D', icon: Copy, onSelect: actions.duplicate },
    {
      kind: 'item',
      label: 'Mensagem no WhatsApp',
      hint: 'W',
      icon: MessageCircle,
      disabled: !hasPhone,
      onSelect: actions.whatsapp,
    },
    { kind: 'sep' },
    { kind: 'item', label: 'Marcar falta', hint: 'F', icon: UserX, disabled: closed, onSelect: actions.fault },
    { kind: 'item', label: 'Cancelar atendimento', hint: '⌫', icon: CircleX, danger: true, disabled: closed, onSelect: actions.cancel },
  ]
}

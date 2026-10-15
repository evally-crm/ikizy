import { ACTIVE_STATUSES, type AppointmentStatus } from '../../types'

export interface SlotAppointment {
  id: string
  professionalId: string
  /** yyyy-MM-dd */
  date: string
  /** minutos desde 00:00 */
  start: number
  duration: number
  status: AppointmentStatus
}

/** outro atendimento ativo da mesma profissional que se sobrepõe ao intervalo informado */
export function findConflict<T extends SlotAppointment>(
  list: T[],
  slot: { professionalId: string; date: string; start: number; duration: number },
  ignoreId?: string,
): T | undefined {
  return list.find(
    (a) =>
      a.id !== ignoreId &&
      a.professionalId === slot.professionalId &&
      a.date === slot.date &&
      ACTIVE_STATUSES.includes(a.status) &&
      a.start < slot.start + slot.duration &&
      slot.start < a.start + a.duration,
  )
}

import { ACTIVE_STATUSES, type AppointmentStatus } from '../../types'
import { END_HOUR, START_HOUR, type HourInterval } from '../../lib/agendaTime'

export interface DayLoad {
  /** minutos de expediente somados de todas as profissionais no dia */
  capacity: number
  /** minutos já marcados (cancelado e faltou não ocupam) */
  booked: number
  /** 0 a 100 */
  pct: number
  /** minutos ainda livres no expediente */
  free: number
  /** soma do que já foi concluído no dia */
  received: number
}

interface LoadAppointment {
  professionalId: string
  duration: number
  price: number
  status: AppointmentStatus
}

/**
 * ocupação do dia: horas marcadas contra o expediente de cada profissional no dia da semana.
 * Quem ainda não cadastrou horário vale a grade padrão da agenda (START_HOUR..END_HOUR).
 */
export function dayLoad(items: LoadAppointment[], professionalIds: string[], hours: Record<string, HourInterval[]>, weekday: number): DayLoad {
  const capacity = professionalIds.reduce((sum, id) => {
    const list = hours[id]
    if (!list?.length) return sum + (END_HOUR - START_HOUR) * 60
    return sum + list.filter((i) => i.weekday === weekday).reduce((s, i) => s + Math.max(0, i.end - i.start), 0)
  }, 0)
  const booked = items.filter((a) => ACTIVE_STATUSES.includes(a.status)).reduce((sum, a) => sum + a.duration, 0)
  const received = items.filter((a) => a.status === 'concluido').reduce((sum, a) => sum + a.price, 0)
  return {
    capacity,
    booked,
    pct: capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0,
    free: Math.max(0, capacity - booked),
    received,
  }
}

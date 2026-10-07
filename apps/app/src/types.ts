export type AppointmentStatus = 'confirmado' | 'pendente' | 'atendimento' | 'concluido'

export interface Professional {
  id: string
  name: string
  role: string
}

export interface Appointment {
  id: string
  professionalId: string
  client: string
  service: string
  /** minutos desde 00:00 */
  start: number
  duration: number
  price: number
  status: AppointmentStatus
}

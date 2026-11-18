export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro'

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credito: 'Crédito',
  debito: 'Débito',
  dinheiro: 'Dinheiro',
}

export type AppointmentStatus = 'confirmado' | 'pendente' | 'atendimento' | 'concluido' | 'cancelado' | 'faltou'

/** status que ocupam o horário da profissional (cancelado e faltou liberam a vaga na conta) */
export const ACTIVE_STATUSES: AppointmentStatus[] = ['pendente', 'confirmado', 'atendimento', 'concluido']

export interface Professional {
  id: string
  name: string
  role: string
}

export interface Appointment {
  id: string
  professionalId: string
  clientId: string
  client: string
  phone: string
  serviceId: string | null
  service: string
  /** yyyy-MM-dd, no fuso do navegador */
  date: string
  /** minutos desde 00:00 */
  start: number
  duration: number
  price: number
  status: AppointmentStatus
  /** como a cliente pagou (informado ao concluir) */
  paymentMethod?: PaymentMethod | null
  /** link secreto do pedido: a página da cliente (status e avaliação) */
  publicToken?: string
  /** a última mudança veio da própria cliente, pelo link do pedido (remarcou ou cancelou) */
  clientChange?: 'remarcado' | 'cancelado' | null
  /** quando a cliente mudou o pedido (ISO) */
  clientChangeAt?: string | null
}

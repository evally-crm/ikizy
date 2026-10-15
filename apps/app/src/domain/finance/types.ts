import type { AppointmentStatus, PaymentMethod } from '../../types'

export type { PaymentMethod }

/** forma de pagamento ou "não informado" (atendimento concluído sem a forma registrada) */
export type MethodKey = PaymentMethod | 'nao'

export interface Expense {
  id: string
  /** yyyy-MM-dd */
  date: string
  description: string
  amount: number
}

export interface CategoryLine {
  name: string
  qty: number
  total: number
}

export interface CommissionLine {
  professionalId: string
  qty: number
  total: number
}

export interface PaymentLine {
  method: string
  total: number
}

/** fechamento de um mês: o que é calculado dos atendimentos e o que fica travado ao fechar */
export interface MonthClosing {
  /** yyyy-MM */
  id: string
  date: Date
  label: string
  isCurrent: boolean
  closedAt: Date | null
  daysInMonth: number
  elapsedDays: number
  categories: CategoryLine[]
  gross: number
  cardFees: number
  products: number
  /** saídas lançadas no mês (aluguel, contas...) */
  expenses: number
  commissions: CommissionLine[]
  commissionsTotal: number
  net: number
  payments: PaymentLine[]
  appointments: number
  ticket: number
  newClients: number
  returnRate: number
  noShows: number
  /** faturamento por dia; null = dia que ainda não chegou */
  daily: (number | null)[]
  /** período que não é um mês inteiro (filtro de datas): sem produtos e sem fechamento */
  partial?: boolean
  /** período por extenso (só em períodos parciais) */
  rangeLabel?: string
}

/** atendimento já encerrado (concluído ou falta), na forma que as regras de finanças precisam */
export interface SettledAppointment {
  id: string
  clientId: string
  clientName: string
  professionalId: string
  serviceName: string
  category: string
  startsAt: Date
  price: number
  status: 'concluido' | 'faltou'
  paymentMethod: PaymentMethod | null
}

export interface ProfessionalRate {
  id: string
  name: string
  /** percentual de comissão (0 = sem comissão) */
  commissionPct: number
}

/** o que o caixa do dia precisa de um atendimento da agenda */
export interface CashAppointment {
  date: string
  start: number
  status: AppointmentStatus
  price: number
  paymentMethod?: PaymentMethod | null
}

export interface MethodTotal {
  method: MethodKey
  label: string
  total: number
}

export interface DayCash<T extends CashAppointment> {
  received: T[]
  toReceive: T[]
  total: number
  expected: number
  byMethod: MethodTotal[]
  expenses: Expense[]
  expensesTotal: number
}

export interface DayStatementItem {
  id: string
  /** minutos desde 00:00 */
  time: number
  clientName: string
  serviceName: string
  professionalId: string
  method: MethodKey
  price: number
}

/** o dia fechado em números: base do recibo do dia */
export interface DayStatement {
  /** yyyy-MM-dd */
  date: string
  items: DayStatementItem[]
  gross: number
  count: number
  noShows: number
  byMethod: MethodTotal[]
  cardFees: number
  commissions: CommissionLine[]
  commissionsTotal: number
  expenses: Expense[]
  expensesTotal: number
  /** o que sobra do dia, sem os produtos (que são um gasto mensal) */
  net: number
}

export type CompositionTone = 'net' | 'commissions' | 'products' | 'expenses' | 'fees'

export interface CompositionPart {
  tone: CompositionTone
  label: string
  value: number
  /** percentual do faturamento, inteiro */
  share: number
}

export interface WeekTotal {
  label: string
  total: number
  future: boolean
  current: boolean
}

export interface ReceiptLine {
  label: string
  qty?: number
  total: number
}

export interface ReceiptSum {
  label: string
  value: number
  /** a última linha do recibo (lucro líquido) */
  total?: boolean
}

export type ReceiptStatKind = 'count' | 'money' | 'percent'

export interface ReceiptStat {
  label: string
  value: number
  kind: ReceiptStatKind
}

/** documento do recibo (dia ou mês): a tela só desenha, não decide o que entra */
export interface ReceiptModel {
  kind: 'day' | 'month'
  /** Nº do recibo (yyyyMM ou yyyyMMdd) */
  number: string
  title: string
  /** período por extenso, em maiúsculas */
  period: string
  salonName: string
  closed: boolean
  /** data/hora do fechamento (mês fechado) */
  closedAt: Date | null
  /** o recibo é só uma prévia (mês em aberto, dia que ainda não acabou) */
  preview: boolean
  /** o que a prévia é (mês em aberto, período parcial, dia em andamento) */
  previewLabel: string
  itemsHeading: string
  lines: ReceiptLine[]
  sums: ReceiptSum[]
  stats: ReceiptStat[]
  chart: {
    title: string
    values: (number | null)[]
    range: [number, number]
    best: { label: string; value: number } | null
  } | null
  /** aviso de cálculo (ex.: produtos entram só no mês) */
  note: string | null
  /** linha de fechamento: quando fechou, ou "valores parciais até..." */
  footer: string
}

/** um dia no mapa do mês */
export interface DayTile {
  day: number
  /** yyyy-MM-dd */
  date: string
  /** faturamento do dia; null = dia que ainda não chegou */
  value: number | null
  /** intensidade 0–4 relativa ao melhor dia */
  level: 0 | 1 | 2 | 3 | 4
  future: boolean
  today: boolean
}

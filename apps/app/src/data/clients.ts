import { addDays, differenceInCalendarDays, format, subDays } from 'date-fns'
import { emptyAnamnesis, type Anamnesis } from '../lib/anamnesis'
import type { AppointmentStatus } from '../types'

export type ClientTag = 'vip' | 'nova' | 'sumida' | 'aniversario'

export interface Visit {
  date: Date
  service: string
  professionalId: string
  price: number
}

/** qualquer atendimento da cliente (concluído, futuro, cancelado, falta) */
export interface ClientAppointment extends Visit {
  status: AppointmentStatus
}

/** movimento do cartão fidelidade: selo extra (> 0) ou prêmio resgatado (< 0) */
export interface LoyaltyEntry {
  id: string
  stamps: number
  note: string
  date: Date
}

export interface LoyaltySettings {
  enabled: boolean
  stampsPerReward: number
  reward: string
}

export const DEFAULT_LOYALTY: LoyaltySettings = { enabled: true, stampsPerReward: 10, reward: 'Um serviço grátis' }

export interface Client {
  id: string
  name: string
  phone: string
  since: Date
  /** MM-dd */
  birthday: string
  vip: boolean
  professionalId: string
  visits: number
  totalSpent: number
  lastVisit: Date
  /** intervalo médio entre visitas, em dias */
  interval: number
  allergies: string[]
  preferences: string[]
  anamnesisSignedAt: Date | null
  email: string
  instagram: string
  address: string
  occupation: string
  /** como conheceu o salão */
  referral: string
  anamnesis: Anamnesis
  anamnesisUpdatedAt: Date | null
  /** assinatura do termo (PNG em data URL) */
  anamnesisSignature: string | null
  /** atendimentos concluídos, do mais recente para o mais antigo */
  history: Visit[]
  /** todos os atendimentos (inclusive futuros, cancelados e faltas), do mais recente para o mais antigo */
  appointments: ClientAppointment[]
  loyalty: LoyaltyEntry[]
}

/** dias sem aparecer para considerar a cliente "sumida" */
export const MISSING_AFTER = 45

interface Seed {
  id: string
  name: string
  phone: string
  sinceDays: number
  birthdayOffset: number
  vip?: boolean
  professionalId: string
  visits: number
  totalSpent: number
  lastDays: number
  interval: number
  services: [string, number][]
  allergies?: string[]
  preferences: string[]
  anamnesis?: boolean
}

const seeds: Seed[] = [
  { id: 'marina', name: 'Marina Costa', phone: '(11) 98765-4321', sinceDays: 820, birthdayOffset: 0, vip: true, professionalId: 'ana', visits: 28, totalSpent: 3920, lastDays: 2, interval: 18, services: [['Esmaltação em gel', 90], ['Manutenção de unhas', 150]], allergies: ['Formol'], preferences: ['Esmalte nude ou vermelho clássico', 'Prefere horários pela manhã'], anamnesis: true },
  { id: 'juliana', name: 'Juliana Prado', phone: '(11) 99812-0045', sinceDays: 610, birthdayOffset: 40, vip: true, professionalId: 'ana', visits: 22, totalSpent: 4180, lastDays: 6, interval: 21, services: [['Alongamento em gel', 220], ['Manutenção de unhas', 150]], preferences: ['Formato amendoado', 'Gosta de nail art discreta'], anamnesis: true },
  { id: 'camila', name: 'Camila Duarte', phone: '(11) 97440-1188', sinceDays: 400, birthdayOffset: 1, professionalId: 'bia', visits: 14, totalSpent: 2460, lastDays: 9, interval: 20, services: [['Manutenção de cílios', 120], ['Fio a fio', 260]], allergies: ['Sensível à cola de cílios'], preferences: ['Curvatura C, 10–12 mm', 'Usa cola hipoalergênica'], anamnesis: true },
  { id: 'larissa', name: 'Larissa Nunes', phone: '(11) 96321-7788', sinceDays: 290, birthdayOffset: 3, professionalId: 'bia', visits: 9, totalSpent: 1420, lastDays: 15, interval: 28, services: [['Lash lifting', 180], ['Design de sobrancelha', 70]], preferences: ['Prefere sábado à tarde'], anamnesis: true },
  { id: 'aline', name: 'Aline Barros', phone: '(11) 98100-3322', sinceDays: 700, birthdayOffset: 120, vip: true, professionalId: 'carla', visits: 18, totalSpent: 5240, lastDays: 24, interval: 35, services: [['Coloração', 380], ['Hidratação profunda', 130]], allergies: ['Amônia'], preferences: ['Tom castanho iluminado', 'Coloração sem amônia'], anamnesis: true },
  { id: 'sofia', name: 'Sofia Martins', phone: '(11) 95544-2010', sinceDays: 12, birthdayOffset: 200, professionalId: 'carla', visits: 1, totalSpent: 130, lastDays: 12, interval: 30, services: [['Hidratação profunda', 130]], preferences: ['Veio por indicação da Aline'] },
  { id: 'patricia', name: 'Patrícia Lima', phone: '(11) 99001-6655', sinceDays: 380, birthdayOffset: 75, professionalId: 'ana', visits: 11, totalSpent: 1530, lastDays: 49, interval: 21, services: [['Manutenção de unhas', 150], ['Esmaltação em gel', 90]], preferences: ['Unhas curtas, cores claras'], anamnesis: true },
  { id: 'fernanda', name: 'Fernanda Rocha', phone: '(11) 97222-9090', sinceDays: 300, birthdayOffset: 160, professionalId: 'ana', visits: 6, totalSpent: 690, lastDays: 63, interval: 30, services: [['Nail art', 110], ['Esmaltação em gel', 90]], preferences: ['Adora nail art temática'] },
  { id: 'beatriz', name: 'Beatriz Alves', phone: '(11) 96650-4411', sinceDays: 240, birthdayOffset: 22, professionalId: 'bia', visits: 8, totalSpent: 960, lastDays: 20, interval: 24, services: [['Manutenção de cílios', 120]], preferences: ['Volume russo leve'], anamnesis: true },
  { id: 'renata', name: 'Renata Gomes', phone: '(11) 98877-1234', sinceDays: 210, birthdayOffset: 250, professionalId: 'bia', visits: 4, totalSpent: 280, lastDays: 52, interval: 30, services: [['Design de sobrancelha', 70]], preferences: ['Sobrancelha natural, sem henna'] },
  { id: 'luciana', name: 'Luciana Teixeira', phone: '(11) 99456-7000', sinceDays: 520, birthdayOffset: 90, professionalId: 'carla', visits: 16, totalSpent: 2560, lastDays: 30, interval: 32, services: [['Corte + escova', 160], ['Escova modelada', 90]], preferences: ['Corte repicado nas pontas'], anamnesis: true },
  { id: 'debora', name: 'Débora Freitas', phone: '(11) 95010-8899', sinceDays: 20, birthdayOffset: 300, professionalId: 'carla', visits: 2, totalSpent: 180, lastDays: 3, interval: 17, services: [['Escova modelada', 90]], preferences: ['Primeira vez no salão'] },
]

function buildClient(s: Seed, today: Date): Client {
  const lastVisit = subDays(today, s.lastDays)
  const historyLength = Math.min(s.visits, 6)
  const history = Array.from({ length: historyLength }, (_, i) => {
    const [service, price] = s.services[i % s.services.length]
    return { date: subDays(lastVisit, i * s.interval), service, professionalId: s.professionalId, price }
  })
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    since: subDays(today, s.sinceDays),
    birthday: format(addDays(today, s.birthdayOffset), 'MM-dd'),
    vip: !!s.vip,
    professionalId: s.professionalId,
    visits: s.visits,
    totalSpent: s.totalSpent,
    lastVisit,
    interval: s.interval,
    allergies: s.allergies ?? [],
    preferences: s.preferences,
    anamnesisSignedAt: s.anamnesis ? subDays(today, Math.min(s.sinceDays, 180)) : null,
    email: '',
    instagram: '',
    address: '',
    occupation: '',
    referral: '',
    anamnesis: s.anamnesis
      ? { answers: { gestante: { yes: false }, medicamento: { yes: false }, lentes: { yes: s.professionalId === 'bia' }, sol: { yes: false }, fumante: { yes: false } }, notes: '' }
      : emptyAnamnesis(),
    anamnesisUpdatedAt: s.anamnesis ? subDays(today, Math.min(s.sinceDays, 180)) : null,
    anamnesisSignature: null,
    history,
    appointments: history.map((v) => ({ ...v, status: 'concluido' as const })),
    loyalty: [],
  }
}

export function getClients(today = new Date()): Client[] {
  return seeds.map((s) => buildClient(s, today))
}

export function daysSince(date: Date, today = new Date()) {
  return differenceInCalendarDays(today, date)
}

export function clientTags(c: Client, today = new Date()): ClientTag[] {
  const tags: ClientTag[] = []
  if (c.vip) tags.push('vip')
  if (daysSince(c.since, today) <= 30) tags.push('nova')
  if (daysSince(c.lastVisit, today) > MISSING_AFTER) tags.push('sumida')
  if (c.birthday.slice(0, 2) === format(today, 'MM')) tags.push('aniversario')
  return tags
}

export const TAG_LABEL: Record<ClientTag, string> = {
  vip: 'VIP',
  nova: 'Nova',
  sumida: 'Sumida',
  aniversario: 'Aniversário',
}

/** situação do cartão: cada atendimento concluído vale um selo; selos extras somam e resgates descontam */
export function loyaltyState(c: Client, settings: LoyaltySettings) {
  const per = settings.stampsPerReward
  const available = Math.max(0, c.visits + c.loyalty.reduce((sum, e) => sum + e.stamps, 0))
  const redeemed = c.loyalty.filter((e) => e.stamps < 0).length
  return {
    available,
    /** selos marcados no cartão atual */
    filled: Math.min(available, per),
    /** prêmios prontos para resgatar */
    ready: Math.floor(available / per),
    missing: available >= per ? 0 : per - available,
    redeemed,
  }
}

import type { Expense, ProfessionalRate, SettledAppointment } from './types'

/** atendimento encerrado de exemplo; só o que o teste precisa mudar vem em `over` */
export function appt(over: Partial<SettledAppointment> & { id: string }): SettledAppointment {
  return {
    clientId: 'c1',
    clientName: 'Ana',
    professionalId: 'p1',
    serviceName: 'Esmaltação',
    category: 'Unhas',
    startsAt: new Date(2026, 9, 12, 10, 0),
    price: 100,
    status: 'concluido',
    paymentMethod: 'pix',
    ...over,
  }
}

export const pro = (id: string, commissionPct = 0): ProfessionalRate => ({ id, name: `Profissional ${id}`, commissionPct })

export const expense = (id: string, date: string, amount: number): Expense => ({ id, date, description: `Saída ${id}`, amount })

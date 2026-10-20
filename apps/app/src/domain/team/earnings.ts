/** atendimento já concluído, como a profissional enxerga (só os dela chegam do banco) */
export interface EarningAppointment {
  id: string
  startsAt: Date
  price: number
  status: string
  clientName: string
  serviceName: string
}

export interface Earnings {
  /** atendimentos concluídos no mês, do mais novo ao mais antigo, com a comissão de cada um */
  done: (EarningAppointment & { commission: number })[]
  /** valor desses atendimentos */
  gross: number
  /** percentual dela (0 quando a dona ainda não definiu) */
  pct: number
  commission: number
  /** marcados ainda por vir no mês */
  upcoming: number
}

const cents = (v: number) => Math.round(v * 100) / 100

/** "Meus ganhos": comissão = percentual sobre os concluídos do mês (R-23, valor cheio) */
export function monthEarnings(appointments: EarningAppointment[], pct: number, month: Date, now = new Date()): Earnings {
  const inMonth = appointments.filter((a) => a.startsAt.getFullYear() === month.getFullYear() && a.startsAt.getMonth() === month.getMonth())
  const done = inMonth
    .filter((a) => a.status === 'concluido')
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .map((a) => ({ ...a, commission: cents((a.price * pct) / 100) }))
  const gross = cents(done.reduce((s, a) => s + a.price, 0))
  return {
    done,
    gross,
    pct,
    commission: cents((gross * pct) / 100),
    upcoming: inMonth.filter((a) => (a.status === 'confirmado' || a.status === 'pendente') && a.startsAt > now).length,
  }
}

import { useEffect, useMemo, useState } from 'react'
import { addMonths, startOfMonth } from 'date-fns'
import { useAuth } from '../auth/AuthProvider'
import { monthEarnings, type EarningAppointment, type Earnings } from '../domain/team'
import { isNeonConfigured, neon } from '../lib/neon'

/**
 * "Meus ganhos" da profissional: atendimentos dela no mês e o percentual de comissão.
 * O banco só devolve os atendimentos dela e só a comissão dela (get_commissions).
 * No modo demonstração, alguns atendimentos de exemplo.
 */

interface Row {
  id: string
  starts_at: string
  price: number | string
  status: string
  service_name: string
  clients: { name: string } | null
}

function demo(month: Date): EarningAppointment[] {
  const at = (day: number, price: number, serviceName: string, clientName: string, status = 'concluido') => ({
    id: `${day}-${serviceName}`,
    startsAt: new Date(month.getFullYear(), month.getMonth(), day, 10),
    price,
    status,
    clientName,
    serviceName,
  })
  return [
    at(2, 180, 'Lash lifting', 'Larissa Nunes'),
    at(4, 260, 'Fio a fio', 'Camila Duarte'),
    at(9, 120, 'Manutenção de cílios', 'Beatriz Alves'),
    at(11, 70, 'Design de sobrancelha', 'Renata Gomes'),
    at(26, 260, 'Fio a fio', 'Marina Costa', 'confirmado'),
  ]
}

export function useEarnings() {
  const { salon } = useAuth()
  const salonId = salon?.id
  const professionalId = salon?.professionalId ?? null
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)

  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [appointments, setAppointments] = useState<EarningAppointment[]>([])
  const [pct, setPct] = useState(live ? 0 : 40)
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!live) {
      setAppointments(demo(month))
      return
    }
    if (!neon || !salonId || !professionalId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const [appts, com] = await Promise.all([
        neon!
          .from('appointments')
          .select('id, starts_at, price, status, service_name, clients ( name )')
          .eq('salon_id', salonId)
          .eq('professional_id', professionalId)
          .gte('starts_at', month.toISOString())
          .lt('starts_at', addMonths(month, 1).toISOString())
          .order('starts_at', { ascending: false }),
        neon!.rpc('get_commissions', { p_salon: salonId }),
      ])
      if (cancelled) return
      if (appts.error) {
        setError('Não foi possível carregar seus ganhos. Verifique a conexão e tente de novo.')
        setLoading(false)
        return
      }
      setError(null)
      setAppointments(
        ((appts.data ?? []) as unknown as Row[]).map((r) => ({
          id: r.id,
          startsAt: new Date(r.starts_at),
          price: Number(r.price),
          status: r.status,
          serviceName: r.service_name,
          clientName: r.clients?.name ?? 'Cliente',
        })),
      )
      const mine = ((com.data ?? []) as { professional_id: string; commission_pct: number | string }[]).find((c) => c.professional_id === professionalId)
      setPct(mine ? Number(mine.commission_pct) : 0)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [live, salonId, professionalId, month])

  const earnings: Earnings = useMemo(() => monthEarnings(appointments, pct, month), [appointments, pct, month])
  const isCurrent = month.getTime() === startOfMonth(new Date()).getTime()

  return {
    loading,
    error,
    month,
    earnings,
    /** sem profissional ligada ao login (não deveria acontecer: o convite de profissional sempre liga) */
    unlinked: live && !professionalId,
    isCurrent,
    prev: () => setMonth((m) => addMonths(m, -1)),
    next: () => setMonth((m) => (isCurrent ? m : addMonths(m, 1))),
  }
}

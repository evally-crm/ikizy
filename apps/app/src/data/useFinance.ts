import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMonths, format, startOfMonth } from 'date-fns'
import { useAuth } from '../auth/AuthProvider'
import { buildDayStatement, buildMonth, buildPeriod } from '../domain/finance'
import type { DayStatement, Expense, MonthClosing, ProfessionalRate, SettledAppointment } from '../domain/finance'
import { isNeonConfigured, neon } from '../lib/neon'
import type { PaymentMethod } from '../types'
import { demoPeriod, getDemoMonths } from './demoFinance'
import { professionals as mockProfessionals } from './mock'

export interface FinanceProfessional {
  id: string
  name: string
}

const MONTHS_SHOWN = 3

interface ApptRow {
  id: string
  client_id: string
  professional_id: string
  service_name: string
  starts_at: string
  price: number | string
  status: 'concluido' | 'faltou'
  payment_method?: PaymentMethod | null
  services: { category: string } | null
}

interface ProRow {
  id: string
  name: string
  commission_pct: number | string
}

interface ClientRow {
  id: string
  name: string
  created_at: string
}

interface ClosingRow {
  month: string
  closed_at: string
  snapshot: SerializedMonth
}

/** o que vai para o banco ao fechar o mês: datas viram texto */
type SerializedMonth = Omit<MonthClosing, 'date' | 'closedAt'> & { date: string; closedAt: string | null }

const serialize = (m: MonthClosing): SerializedMonth => ({ ...m, date: m.date.toISOString(), closedAt: null })

const revive = (snap: SerializedMonth, closedAt: string): MonthClosing => ({
  ...snap,
  expenses: snap.expenses ?? 0,
  date: new Date(snap.date),
  closedAt: new Date(closedAt),
})

function friendly(error: { code?: string; message: string }) {
  if (error.code === '23514' || error.message.includes('já está fechado')) return 'Esse mês já está fechado.'
  if (error.message.includes('snapshot_stale')) return 'Os números mudaram desde que você abriu a tela. Recarregamos: confira e feche de novo.'
  if (error.message.includes('sem acesso ativo')) return 'Renove a assinatura para fechar o mês.'
  if (error.code === '42501' || error.message.includes('sem permissão')) return 'Só a dona ou a gerente pode fazer isso.'
  return 'Não foi possível salvar agora. Tente novamente.'
}

/** financeiro do salão: busca os atendimentos encerrados e entrega os meses calculados pelo domínio (ou dados de exemplo sem banco) */
export function useFinance() {
  const { salon } = useAuth()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)
  const today = useMemo(() => new Date(), [])

  const [months, setMonths] = useState<MonthClosing[]>(() => (live ? [] : getDemoMonths(today)))
  const [appointments, setAppointments] = useState<SettledAppointment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [rates, setRates] = useState<ProfessionalRate[]>([])
  const [clientsCreated, setClientsCreated] = useState<Record<string, Date>>({})
  const [professionals, setProfessionals] = useState<FinanceProfessional[]>(() => (live ? [] : mockProfessionals))
  const [expensesAvailable, setExpensesAvailable] = useState(true)
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!live || !neon || !salonId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      const first = startOfMonth(addMonths(today, -(MONTHS_SHOWN - 1)))
      const apptSelect = (withPayment: boolean) =>
        neon!
          .from('appointments')
          .select(
            `id, client_id, professional_id, service_name, starts_at, price, status, ${withPayment ? 'payment_method, ' : ''}services ( category )`,
          )
          .eq('salon_id', salonId)
          .in('status', ['concluido', 'faltou'])
          .gte('starts_at', first.toISOString())

      let apptRes = await apptSelect(true)
      // a coluna de forma de pagamento vem da migration do financeiro; sem ela, seguimos sem esse detalhe
      if (apptRes.error) apptRes = await apptSelect(false)

      const [pros, cls, prods, closings, exps] = await Promise.all([
        neon.from('professionals').select('id, name, commission_pct').eq('salon_id', salonId),
        neon.from('clients').select('id, name, created_at').eq('salon_id', salonId),
        neon.from('products').select('monthly_spend').eq('salon_id', salonId),
        neon.from('month_closings').select('month, closed_at, snapshot').eq('salon_id', salonId).gte('month', format(first, 'yyyy-MM-dd')),
        neon.from('expenses').select('id, spent_on, description, amount').eq('salon_id', salonId).gte('spent_on', format(first, 'yyyy-MM-dd')).order('spent_on', { ascending: false }),
      ])
      if (cancelled) return
      if (apptRes.error || pros.error || cls.error || prods.error || closings.error) {
        setError('Não foi possível carregar o financeiro. Verifique a conexão e tente de novo.')
        setLoading(false)
        return
      }
      setExpensesAvailable(!exps.error)

      const expenseList: Expense[] = (exps.data ?? []).map((e) => ({
        id: e.id as string,
        date: e.spent_on as string,
        description: e.description as string,
        amount: Number(e.amount),
      }))
      const proRows = (pros.data ?? []) as unknown as ProRow[]
      const clientRows = (cls.data ?? []) as unknown as ClientRow[]
      const clientName = new Map(clientRows.map((c) => [c.id, c.name]))
      const settled: SettledAppointment[] = ((apptRes.data ?? []) as unknown as ApptRow[]).map((r) => ({
        id: r.id,
        clientId: r.client_id,
        clientName: clientName.get(r.client_id) ?? 'Cliente',
        professionalId: r.professional_id,
        serviceName: r.service_name,
        category: r.services?.category ?? '',
        startsAt: new Date(r.starts_at),
        price: Number(r.price),
        status: r.status,
        paymentMethod: r.payment_method ?? null,
      }))
      const professionalRates: ProfessionalRate[] = proRows.map((p) => ({ id: p.id, name: p.name, commissionPct: Number(p.commission_pct) }))
      const clientsCreated = Object.fromEntries(clientRows.map((c) => [c.id, new Date(c.created_at)]))
      const productsSpend = (prods.data ?? []).reduce((s, p) => s + Number(p.monthly_spend), 0)

      const closed = new Map(((closings.data ?? []) as unknown as ClosingRow[]).map((c) => [c.month.slice(0, 7), c]))
      const list = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
        const date = startOfMonth(addMonths(today, i - (MONTHS_SHOWN - 1)))
        const snap = closed.get(format(date, 'yyyy-MM'))
        if (snap) return revive(snap.snapshot, snap.closed_at)
        return buildMonth({
          date,
          today,
          current: i === MONTHS_SHOWN - 1,
          appointments: settled,
          professionals: professionalRates,
          clientsCreated,
          productsSpend,
          expenses: expenseList,
        })
      })

      setAppointments(settled)
      setRates(professionalRates)
      setClientsCreated(clientsCreated)
      setProfessionals(proRows.map((p) => ({ id: p.id, name: p.name })))
      setExpenses(expenseList)
      setMonths(list)
      setError(null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [live, salonId, today, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  const addExpense = useCallback(
    async (input: { date: string; description: string; amount: number }): Promise<string | null> => {
      if (!live || !neon || !salonId) {
        setExpenses((l) => [{ id: `e-${Date.now()}`, ...input }, ...l])
        return null
      }
      const { error: err } = await neon
        .from('expenses')
        .insert({ salon_id: salonId, spent_on: input.date, description: input.description, amount: input.amount })
      if (err) return friendly(err)
      reload()
      return null
    },
    [live, salonId, reload],
  )

  const removeExpense = useCallback(
    async (id: string): Promise<string | null> => {
      if (!live || !neon || !salonId) {
        setExpenses((l) => l.filter((e) => e.id !== id))
        return null
      }
      const { data, error: err } = await neon.from('expenses').delete().eq('id', id).select('id')
      if (err) return friendly(err)
      if (!data?.length) return 'Só a dona ou a gerente pode apagar saídas.'
      reload()
      return null
    },
    [live, salonId, reload],
  )

  /** trava o mês: guarda o retrato dos números e bloqueia alterações do período */
  const closeMonth = useCallback(
    async (month: MonthClosing): Promise<string | null> => {
      if (!live || !neon || !salonId) return null
      const { error: err } = await neon.rpc('close_month', {
        p_salon: salonId,
        p_month: format(month.date, 'yyyy-MM-01'),
        p_snapshot: serialize(month),
      })
      if (err) {
        // números velhos (outra aba, outra pessoa): relê para a tela mostrar o que está no banco
        reload()
        return friendly(err)
      }
      reload()
      return null
    },
    [live, salonId, reload],
  )

  /** o dia em números (yyyy-MM-dd), para o recibo do dia */
  const statementFor = useCallback(
    (date: string): DayStatement => buildDayStatement({ date, appointments, professionals: rates, expenses }),
    [appointments, rates, expenses],
  )

  /** o período escolhido no filtro de datas (de `from` a `to`, inclusive), com os mesmos números do mês */
  const periodFor = useCallback(
    (from: Date, to: Date) =>
      live ? buildPeriod({ from, to, today, appointments, professionals: rates, clientsCreated, expenses }) : demoPeriod(months, from, to),
    [live, today, appointments, rates, clientsCreated, expenses, months],
  )

  // sem banco, o mês exibido pode ter saídas novas ainda não refletidas no resumo de exemplo
  const monthsWithExpenses = useMemo(
    () =>
      live
        ? months
        : months.map((m) => {
            const spent = expenses.filter((e) => e.date.startsWith(m.id)).reduce((s, e) => s + e.amount, 0)
            return m.closedAt || spent === 0 ? m : { ...m, expenses: spent, net: m.net - spent }
          }),
    [live, months, expenses],
  )

  return {
    live,
    months: monthsWithExpenses,
    expenses,
    professionals,
    expensesAvailable,
    loading,
    error,
    reload,
    addExpense,
    removeExpense,
    closeMonth,
    statementFor,
    periodFor,
    /** primeiro dia com dados carregados (o filtro não vai além) */
    firstDay: startOfMonth(addMonths(today, -(MONTHS_SHOWN - 1))),
    today,
  }
}

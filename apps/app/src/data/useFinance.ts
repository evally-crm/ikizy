import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMonths, format, getDate, getDaysInMonth, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../auth/AuthProvider'
import { isNeonConfigured, neon } from '../lib/neon'
import { PAYMENT_LABEL, type PaymentMethod } from '../types'
import { professionals as mockProfessionals } from './mock'
import { getMonths, type MonthClosing } from './finance'

export interface Expense {
  id: string
  /** yyyy-MM-dd */
  date: string
  description: string
  amount: number
}

export interface FinanceProfessional {
  id: string
  name: string
}

/** taxa média cobrada pela maquininha nos pagamentos em crédito e débito (estimativa) */
export const CARD_FEE_PCT = 3.1

const MONTHS_SHOWN = 3

interface ApptRow {
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

interface Inputs {
  appts: ApptRow[]
  pros: ProRow[]
  clientsCreated: Record<string, Date>
  productsSpend: number
  expenses: Expense[]
}

function buildMonth(date: Date, today: Date, current: boolean, d: Inputs): MonthClosing {
  const from = date.getTime()
  const to = addMonths(date, 1).getTime()
  const inMonth = d.appts.filter((a) => {
    const t = new Date(a.starts_at).getTime()
    return t >= from && t < to
  })
  const done = inMonth.filter((a) => a.status === 'concluido')
  const money = (a: ApptRow) => Number(a.price)
  const gross = done.reduce((s, a) => s + money(a), 0)

  const byCategory = new Map<string, { qty: number; total: number }>()
  for (const a of done) {
    const key = a.services?.category ?? 'Outros'
    const row = byCategory.get(key) ?? { qty: 0, total: 0 }
    row.qty += 1
    row.total += money(a)
    byCategory.set(key, row)
  }
  const categories = [...byCategory.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total)

  const byPro = new Map<string, { qty: number; total: number }>()
  for (const a of done) {
    const row = byPro.get(a.professional_id) ?? { qty: 0, total: 0 }
    row.qty += 1
    row.total += money(a)
    byPro.set(a.professional_id, row)
  }
  // só entra comissão de quem tem percentual definido; sem equipe (ou sem %), não há o que descontar
  const commissions = d.pros
    .filter((p) => Number(p.commission_pct) > 0)
    .map((p) => {
      const sold = byPro.get(p.id) ?? { qty: 0, total: 0 }
      return { professionalId: p.id, qty: sold.qty, total: Math.round(sold.total * (Number(p.commission_pct) / 100) * 100) / 100 }
    })
    .filter((c) => c.qty > 0)
  const commissionsTotal = commissions.reduce((s, c) => s + c.total, 0)

  const paid = new Map<string, number>()
  for (const a of done) {
    const label = a.payment_method ? PAYMENT_LABEL[a.payment_method] : 'Não informado'
    paid.set(label, (paid.get(label) ?? 0) + money(a))
  }
  const payments = [...paid.entries()].map(([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total)
  const cardTotal = done
    .filter((a) => a.payment_method === 'credito' || a.payment_method === 'debito')
    .reduce((s, a) => s + money(a), 0)
  const cardFees = Math.round(cardTotal * (CARD_FEE_PCT / 100) * 100) / 100

  const monthKey = format(date, 'yyyy-MM')
  const expenses = d.expenses.filter((e) => e.date.startsWith(monthKey)).reduce((s, e) => s + e.amount, 0)
  const products = d.productsSpend

  const daysInMonth = getDaysInMonth(date)
  const elapsedDays = current ? getDate(today) : daysInMonth
  const daily: (number | null)[] = Array.from({ length: daysInMonth }, (_, i) => (i + 1 > elapsedDays ? null : 0))
  for (const a of done) {
    const day = new Date(a.starts_at).getDate() - 1
    daily[day] = (daily[day] ?? 0) + money(a)
  }

  const servedIds = new Set(done.map((a) => a.client_id))
  const returning = [...servedIds].filter((id) => (d.clientsCreated[id]?.getTime() ?? Infinity) < from).length
  const newClients = Object.values(d.clientsCreated).filter((c) => c.getTime() >= from && c.getTime() < to).length

  return {
    id: monthKey,
    date,
    label: format(date, 'MMMM', { locale: ptBR }),
    isCurrent: current,
    closedAt: null,
    daysInMonth,
    elapsedDays,
    categories,
    gross,
    cardFees,
    products,
    expenses,
    commissions,
    commissionsTotal,
    net: gross - cardFees - products - expenses - commissionsTotal,
    payments,
    appointments: done.length,
    ticket: done.length ? Math.round(gross / done.length) : 0,
    newClients,
    returnRate: servedIds.size ? Math.round((returning / servedIds.size) * 100) : 0,
    noShows: inMonth.filter((a) => a.status === 'faltou').length,
    daily,
  }
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === '23514' || error.message.includes('já está fechado')) return 'Esse mês já está fechado.'
  if (error.code === '42501' || error.message.includes('sem permissão')) return 'Só a dona ou a gerente pode fazer isso.'
  return 'Não foi possível salvar agora. Tente novamente.'
}

/** financeiro do salão: calculado dos atendimentos concluídos (ou dados de exemplo quando não há banco) */
export function useFinance() {
  const { salon } = useAuth()
  const salonId = salon?.id
  const live = isNeonConfigured && Boolean(neon) && Boolean(salonId)
  const today = useMemo(() => new Date(), [])

  const [months, setMonths] = useState<MonthClosing[]>(() => (live ? [] : getMonths(today)))
  const [expenses, setExpenses] = useState<Expense[]>([])
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
            `client_id, professional_id, service_name, starts_at, price, status, ${withPayment ? 'payment_method, ' : ''}services ( category )`,
          )
          .eq('salon_id', salonId)
          .in('status', ['concluido', 'faltou'])
          .gte('starts_at', first.toISOString())

      let apptRes = await apptSelect(true)
      // a coluna de forma de pagamento vem da migration do financeiro; sem ela, seguimos sem esse detalhe
      if (apptRes.error) apptRes = await apptSelect(false)

      const [pros, cls, prods, closings, exps] = await Promise.all([
        neon.from('professionals').select('id, name, commission_pct').eq('salon_id', salonId),
        neon.from('clients').select('id, created_at').eq('salon_id', salonId),
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
      const inputs: Inputs = {
        appts: (apptRes.data ?? []) as unknown as ApptRow[],
        pros: proRows,
        clientsCreated: Object.fromEntries((cls.data ?? []).map((c) => [c.id as string, new Date(c.created_at as string)])),
        productsSpend: (prods.data ?? []).reduce((s, p) => s + Number(p.monthly_spend), 0),
        expenses: expenseList,
      }
      const closed = new Map(((closings.data ?? []) as unknown as ClosingRow[]).map((c) => [c.month.slice(0, 7), c]))
      const list = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
        const date = startOfMonth(addMonths(today, i - (MONTHS_SHOWN - 1)))
        const snap = closed.get(format(date, 'yyyy-MM'))
        return snap ? revive(snap.snapshot, snap.closed_at) : buildMonth(date, today, i === MONTHS_SHOWN - 1, inputs)
      })
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
      if (err) return friendly(err)
      reload()
      return null
    },
    [live, salonId, reload],
  )

  // o mês exibido pode ter saídas novas ainda não refletidas no resumo da demonstração
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
  }
}

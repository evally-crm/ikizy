import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FileText, Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useAgenda } from '../../data/AgendaProvider'
import { useFinance } from '../../data/useFinance'
import { buildDayCash, buildDayReceipt, methodLabel, type ReceiptModel } from '../../domain/finance'
import { FinPanel } from '../../components/finance/FinPanel'
import { LedgerList, type LedgerRow } from '../../components/finance/LedgerList'
import { ReceiptSheet } from '../../components/finance/ReceiptSheet'
import { Button, Em, Money, PageHeader, StatTile } from '../../components/ui'
import { formatBRL, formatTime } from '../../lib/format'
import { agenda } from '../../lib/routes'
import { ExpenseDialog } from './ExpenseDialog'
import './Financeiro.css'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** caixa do dia: o que entrou (por forma de pagamento), o que falta receber e as saídas de hoje */
export function TodayView({ tabs }: { tabs: ReactNode }) {
  const { salon } = useAuth()
  const { appointments, professionals } = useAgenda()
  const fin = useFinance()
  const [adding, setAdding] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptModel | null>(null)

  const now = useMemo(() => new Date(), [])
  const today = format(now, 'yyyy-MM-dd')
  const salonName = salon?.name ?? 'Studio Maria Beauty'
  const cash = useMemo(() => buildDayCash(today, appointments, fin.expenses), [today, appointments, fin.expenses])
  const currentMonth = fin.months[fin.months.length - 1]
  const proName = (id: string) => (professionals.length > 1 ? (professionals.find((p) => p.id === id)?.name ?? '') : '')

  const receivedRows: LedgerRow[] = cash.received.map((a) => ({
    id: a.id,
    lead: formatTime(a.start),
    title: a.client,
    subtitle: [a.service, proName(a.professionalId), methodLabel(a.paymentMethod ?? 'nao')].filter(Boolean).join(' · '),
    value: formatBRL(a.price),
  }))
  const expenseRows: LedgerRow[] = cash.expenses.map((e) => ({ id: e.id, title: e.description, value: `− ${formatBRL(e.amount)}` }))

  return (
    <div className="page finpage">
      <PageHeader
        title={
          <>
            Caixa de <Em>hoje</Em>
          </>
        }
        crumb={capitalize(format(now, "EEEE, d 'de' MMMM", { locale: ptBR }))}
        actions={
          <>
            {tabs}
            <Button variant="soft" size="sm" onClick={() => setReceipt(buildDayReceipt(fin.statementFor(today), { salonName, now }))}>
              <FileText size={15} aria-hidden="true" /> Recibo de hoje
            </Button>
            {fin.expensesAvailable && currentMonth && !currentMonth.closedAt && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus size={15} aria-hidden="true" /> Saída
              </Button>
            )}
          </>
        }
      />

      <div className="fintiles fintiles--three">
        <StatTile
          tone="dark"
          label="Recebido hoje"
          value={<Money value={cash.total} size="xl" />}
          hint={
            <>
              {cash.received.length} {cash.received.length === 1 ? 'atendimento concluído' : 'atendimentos concluídos'}
              {cash.expensesTotal > 0 && ` · saídas ${formatBRL(cash.expensesTotal)}`}
            </>
          }
        >
          {cash.byMethod.length > 0 && (
            <ul className="fintoday__methods">
              {cash.byMethod.map((m) => (
                <li key={m.method}>
                  <span>{m.label}</span>
                  <strong>{formatBRL(m.total).replace(',00', '')}</strong>
                </li>
              ))}
            </ul>
          )}
        </StatTile>

        <StatTile
          label="A receber hoje"
          value={formatBRL(cash.expected)}
          hint={
            cash.toReceive.length === 0
              ? 'Nada mais previsto para hoje.'
              : `${cash.toReceive.length} ${cash.toReceive.length === 1 ? 'atendimento' : 'atendimentos'} ainda por concluir. Ao concluir na agenda, informe como a cliente pagou.`
          }
        >
          {cash.toReceive.length > 0 && (
            <Link to={agenda()} className="textlink">
              Abrir a agenda
            </Link>
          )}
        </StatTile>
      </div>

      <div className="finlayout">
        <FinPanel eyebrow="Entradas" title="Recebimentos de hoje">
          {receivedRows.length === 0 ? (
            <p className="finpanel__empty">Os recebimentos aparecem quando você conclui atendimentos na agenda.</p>
          ) : (
            <LedgerList rows={receivedRows} />
          )}
        </FinPanel>
        <FinPanel eyebrow="Saídas" title="Saídas de hoje">
          {expenseRows.length === 0 ? <p className="finpanel__empty">Nenhuma saída lançada hoje.</p> : <LedgerList rows={expenseRows} />}
        </FinPanel>
      </div>

      {adding && currentMonth && <ExpenseDialog month={currentMonth} onSave={fin.addExpense} onClose={() => setAdding(false)} />}
      {receipt && <ReceiptSheet model={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}

import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { FileText, Lock, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useFinance } from '../../data/useFinance'
import {
  bestWeekIndex,
  buildDayReceipt,
  buildMonthReceipt,
  cardFeeLabel,
  composition,
  dayTiles,
  growthPct,
  marginPct,
  outflowOf,
  paymentShares,
  showsTeam,
  waffleCounts,
  weeklyAverage,
  weeksOf,
  type Expense,
  type ReceiptModel,
} from '../../domain/finance'
import { DotWaffle } from '../../components/charts/DotWaffle'
import { Gauge } from '../../components/charts/Gauge'
import { PaymentColumns } from '../../components/charts/PaymentColumns'
import { WeeklyBars } from '../../components/charts/WeeklyBars'
import { DayGrid } from '../../components/finance/DayGrid'
import { LedgerList, type LedgerRow } from '../../components/finance/LedgerList'
import { ReceiptSheet } from '../../components/finance/ReceiptSheet'
import { Avatar, Button, Em, Money, PageHeader, Panel, StatTile, Tabs } from '../../components/ui'
import { formatBRL } from '../../lib/format'
import { agenda } from '../../lib/routes'
import { CloseDialog } from './CloseDialog'
import { ExpenseDialog } from './ExpenseDialog'
import './Financeiro.css'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const short = (v: number) => formatBRL(v).replace(',00', '')

/** fechamento do mês: números, mapa de dias (cada dia abre o recibo dele) e o recibo do mês */
export function MonthView({ tabs }: { tabs: ReactNode }) {
  const { salon } = useAuth()
  const fin = useFinance()
  const { months, professionals } = fin
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [closedNow, setClosedNow] = useState<Record<string, Date>>({})
  const [confirming, setConfirming] = useState(false)
  const [addingExpense, setAddingExpense] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptModel | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (fin.loading) {
    return (
      <div className="page">
        <p className="panel__empty" role="status">
          Carregando financeiro…
        </p>
      </div>
    )
  }
  if (months.length === 0) {
    return (
      <div className="page">
        <p className="dialog__error" role="alert">
          {fin.error ?? 'Sem dados para mostrar.'}{' '}
          <button type="button" className="textlink" onClick={fin.reload}>
            Tentar de novo
          </button>
        </p>
      </div>
    )
  }

  const month = months.find((m) => m.id === selectedId) ?? months[months.length - 1]
  const previous = months[months.indexOf(month) - 1]
  const closedAt = month.closedAt ?? closedNow[month.id] ?? null
  const salonName = salon?.name ?? 'Studio Maria Beauty'
  const now = new Date()

  const growth = growthPct(month, previous)
  const weeks = weeksOf(month)
  const parts = composition(month)
  const counts = waffleCounts(parts.map((p) => p.value), month.gross)
  const shares = paymentShares(month.payments)
  const { leading, days } = dayTiles(month)
  const monthExpenses = fin.expenses.filter((e) => e.date.startsWith(month.id))
  const professionalName = (id: string) => professionals.find((p) => p.id === id)?.name ?? 'Profissional'
  const canLaunch = !closedAt && fin.expensesAvailable

  const closeMonth = async () => {
    setActionError(null)
    const message = await fin.closeMonth(month)
    if (message) setActionError(message)
    else if (!fin.live) setClosedNow((c) => ({ ...c, [month.id]: new Date() }))
    setConfirming(false)
    setReceipt(null)
  }

  const removeExpense = async (e: Expense) => {
    setActionError(null)
    const message = await fin.removeExpense(e.id)
    if (message) setActionError(message)
  }

  const expenseRows: LedgerRow[] = monthExpenses.map((e) => ({
    id: e.id,
    lead: format(new Date(`${e.date}T12:00:00`), 'dd/MM'),
    title: e.description,
    value: formatBRL(e.amount),
    action: !closedAt && (
      <button type="button" className="finaction" aria-label={`Apagar ${e.description}`} onClick={() => void removeExpense(e)}>
        <Trash2 size={16} aria-hidden="true" />
      </button>
    ),
  }))

  const commissionRows: LedgerRow[] = month.commissions.map((c) => ({
    id: c.professionalId,
    lead: <Avatar name={professionalName(c.professionalId)} size="sm" soft />,
    title: professionalName(c.professionalId),
    subtitle: `${c.qty} atendimentos`,
    value: formatBRL(c.total),
  }))

  return (
    <div className="page finpage">
      <PageHeader
        title="Fechamento mensal"
        crumb={
          <>
            Financeiro <span aria-hidden="true">/</span> {capitalize(month.label)} {format(month.date, 'yyyy')}
          </>
        }
        actions={
          <>
            {tabs}
            <Tabs
              label="Mês"
              value={month.id}
              onChange={setSelectedId}
              items={months.map((m) => ({
                id: m.id,
                label: capitalize(m.label),
                badge: m.closedAt || closedNow[m.id] ? <Lock size={12} aria-label="fechado" /> : null,
              }))}
            />
            <Button variant="soft" size="sm" onClick={() => setReceipt(buildMonthReceipt(month, closedAt, { salonName, now }))}>
              <FileText size={15} aria-hidden="true" /> Recibo do mês
            </Button>
            {canLaunch && (
              <Button size="sm" onClick={() => setAddingExpense(true)}>
                <Plus size={15} aria-hidden="true" /> Saída
              </Button>
            )}
          </>
        }
      />

      {(fin.error || actionError) && (
        <p className="dialog__error" role="alert">
          {actionError ?? fin.error}
        </p>
      )}

      <div className="fintiles">
        <StatTile
          tone="dark"
          label="Faturamento bruto"
          value={<Money value={month.gross} size="lg" />}
          trend={growth !== null && !month.isCurrent ? { percent: growth, versus: previous?.label ?? '' } : null}
          hint={`${capitalize(month.label)} ${format(month.date, 'yyyy')} · ${closedAt ? 'fechado' : month.isCurrent ? 'mês em aberto' : 'aguardando fechamento'}`}
        />
        <StatTile
          label="Lucro líquido"
          value={<Money value={month.net} size="lg" />}
          hint={`Margem de ${marginPct(month)}% · saídas ${short(outflowOf(month))}`}
        />
        <StatTile label="Ticket médio" value={<Money value={month.ticket} size="lg" />} hint={`${month.newClients} novas clientes · retorno ${month.returnRate}%`} />
        <StatTile label="Atendimentos" value={month.appointments} hint={month.noShows > 0 ? `${month.noShows} faltas` : 'Nenhuma falta'} />
      </div>

      <div className="finlayout">
        <div className="fincol">
          <Panel
            eyebrow="Toque num dia para ver o recibo"
            title="Dias do mês"
            action={month.gross > 0 && <span className="panel__aside">Média de {short(weeklyAverage(month))} por semana</span>}
          >
            {month.gross === 0 && (
              <p className="panel__empty">
                Entra aqui conforme você conclui atendimentos. <Link to={agenda()}>Abrir agenda</Link>
              </p>
            )}
            <DayGrid
              leading={leading}
              days={days}
              onSelect={(date) => setReceipt(buildDayReceipt(fin.statementFor(date), { salonName, now }))}
            />
            <WeeklyBars weeks={weeks} bestIndex={bestWeekIndex(weeks)} label={`Faturamento por semana em ${month.label}`} />
          </Panel>

          <Panel eyebrow="Recebimentos" title="Formas de pagamento">
            {shares.length === 0 ? (
              <p className="panel__empty">Os recebimentos aparecem quando você conclui atendimentos na agenda.</p>
            ) : (
              <PaymentColumns shares={shares} />
            )}
          </Panel>

          {showsTeam(month, professionals.length) && (
            <Panel
              eyebrow="Equipe"
              title="Comissões"
              action={month.commissionsTotal > 0 && <strong>{formatBRL(month.commissionsTotal)}</strong>}
            >
              {commissionRows.length === 0 ? (
                <p className="panel__empty">Nenhuma profissional com comissão definida. Defina o percentual de cada uma para calcular.</p>
              ) : (
                <LedgerList rows={commissionRows} />
              )}
            </Panel>
          )}
        </div>

        <div className="fincol">
          {closedAt ? (
            <StatTile
              tone="brand"
              label="Fechamento"
              value={`${capitalize(month.label)} está fechado`}
              hint={`Fechado em ${format(closedAt, "dd/MM 'às' HH:mm")}. Os números não mudam mais.`}
            />
          ) : (
            <StatTile
              tone="brand"
              label={month.isCurrent ? `${month.daysInMonth - month.elapsedDays} dias para o fim do mês` : 'Mês já terminou'}
              value={
                <>
                  Pronta para fechar <Em>{month.label}</Em>?
                </>
              }
              hint="Confira o recibo e trave os lançamentos do mês."
            >
              <Button variant="light" onClick={() => setConfirming(true)}>
                <Lock size={16} aria-hidden="true" /> Fechar {month.label}
              </Button>
            </StatTile>
          )}

          <Panel eyebrow="Para onde foi o dinheiro" title="Composição do faturamento">
            <DotWaffle parts={parts.map((p, i) => ({ tone: p.tone, count: counts[i] }))} />
            <ul className="finlegend">
              {parts.map((p) => (
                <li key={p.tone}>
                  <i className={`finlegend__dot finlegend__dot--${p.tone}`} />
                  <span>{p.label}</span>
                  <span className="finlegend__pct">{p.share}%</span>
                  <strong>{formatBRL(p.value)}</strong>
                </li>
              ))}
            </ul>
            <Gauge value={marginPct(month)} label={`Margem de lucro: ${marginPct(month)}%`} />
            <p className="panel__note">
              Cada ponto vale 2% do faturamento. Taxas de cartão estimadas em {cardFeeLabel()}% do crédito e do débito; produtos vêm do gasto mensal cadastrado em
              Meu site.
            </p>
          </Panel>

          <Panel
            eyebrow="Caixa"
            title="Saídas do mês"
            action={
              canLaunch && (
                <Button size="sm" onClick={() => setAddingExpense(true)}>
                  <Plus size={16} aria-hidden="true" /> Lançar
                </Button>
              )
            }
          >
            {!fin.expensesAvailable ? (
              <p className="panel__empty">As saídas ficam disponíveis assim que a atualização do banco for aplicada.</p>
            ) : expenseRows.length === 0 ? (
              <p className="panel__empty">Nenhuma saída lançada em {month.label}. Aluguel, luz e material entram aqui.</p>
            ) : (
              <LedgerList rows={expenseRows} />
            )}
          </Panel>
        </div>
      </div>

      {addingExpense && <ExpenseDialog month={month} onSave={fin.addExpense} onClose={() => setAddingExpense(false)} />}
      {confirming && <CloseDialog month={month} onCancel={() => setConfirming(false)} onConfirm={() => void closeMonth()} />}
      {receipt && (
        <ReceiptSheet
          model={receipt}
          onClose={() => setReceipt(null)}
          extra={
            receipt.kind === 'month' &&
            !closedAt && (
              <Button size="sm" onClick={() => setConfirming(true)}>
                <Lock size={15} aria-hidden="true" /> Fechar {month.label}
              </Button>
            )
          }
        />
      )}
    </div>
  )
}

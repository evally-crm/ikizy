import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { CalendarDays, CreditCard, FileText, Lock, PieChart, Plus, Trash2, Users, Wallet } from 'lucide-react'
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
  paymentShares,
  showsTeam,
  weeklyAverage,
  weeksOf,
  type Expense,
  type ReceiptModel,
} from '../../domain/finance'
import { DayGrid } from '../../components/finance/DayGrid'
import { LedgerList, type LedgerRow } from '../../components/finance/LedgerList'
import { Receipt } from '../../components/finance/Receipt'
import { ReceiptSheet } from '../../components/finance/ReceiptSheet'
import { Avatar, Button, PageHeader, Tabs } from '../../components/ui'
import { formatBRL } from '../../lib/format'
import { agenda } from '../../lib/routes'
import { CloseDialog } from './CloseDialog'
import { ExpenseDialog } from './ExpenseDialog'
import './Financeiro.css'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const short = (v: number) => formatBRL(v).replace(',00', '')

/** fechamento do mês: números, detalhes à esquerda (cada dia abre o recibo dele) e a prévia do recibo do mês à direita */
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
  const bestWeek = bestWeekIndex(weeks)
  const weekMax = Math.max(0, ...weeks.map((w) => w.total))
  const parts = composition(month)
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

  const trendHint =
    growth !== null && !month.isCurrent
      ? `${growth >= 0 ? '+' : ''}${growth}% vs ${previous?.label ?? ''}`
      : closedAt
        ? 'Mês fechado'
        : month.isCurrent
          ? 'Mês em aberto'
          : 'Aguardando fechamento'

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

      <div className="fm-stats">
        <div className="fm-stat fm-stat--dark">
          <span className="fm-stat__label">Faturamento bruto</span>
          <strong className="fm-stat__value">{formatBRL(month.gross)}</strong>
          <span className="fm-stat__hint">{trendHint}</span>
        </div>
        <div className="fm-stat">
          <span className="fm-stat__label">Lucro líquido</span>
          <strong className="fm-stat__value">{formatBRL(month.net)}</strong>
          <span className="fm-stat__hint">Margem de {marginPct(month)}%</span>
        </div>
        <div className="fm-stat">
          <span className="fm-stat__label">Ticket médio</span>
          <strong className="fm-stat__value">{formatBRL(month.ticket)}</strong>
          <span className="fm-stat__hint">
            {month.newClients} novas · retorno {month.returnRate}%
          </span>
        </div>
        <div className="fm-stat">
          <span className="fm-stat__label">Atendimentos</span>
          <strong className="fm-stat__value">{month.appointments}</strong>
          <span className="fm-stat__hint">{month.noShows > 0 ? `${month.noShows} faltas` : 'Nenhuma falta'}</span>
        </div>
      </div>

      <div className="fm-layout">
        <div className="fm-details">
          <section className="fm-card">
            <h2 className="fm-card__title">
              <CalendarDays size={16} aria-hidden="true" /> Dias do mês
              {month.gross > 0 && <span className="fm-card__aside">Média de {short(weeklyAverage(month))} por semana</span>}
            </h2>
            {month.gross === 0 && (
              <p className="fm-empty">
                Entra aqui conforme você conclui atendimentos. <Link to={agenda()}>Abrir agenda</Link>
              </p>
            )}
            <DayGrid
              leading={leading}
              days={days}
              onSelect={(date) => setReceipt(buildDayReceipt(fin.statementFor(date), { salonName, now }))}
            />
            <ul className="fm-rows">
              {weeks.map((w, i) => (
                <li key={w.label} className={w.future ? 'is-future' : undefined}>
                  <span className="fm-rows__label">
                    {w.label}
                    {i === bestWeek && w.total > 0 && <em className="fm-pill">melhor</em>}
                  </span>
                  <span className="fm-bar" aria-hidden="true">
                    <span style={{ width: `${weekMax > 0 ? Math.round((w.total / weekMax) * 100) : 0}%` }} />
                  </span>
                  <strong>{w.future ? '—' : formatBRL(w.total)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="fm-card">
            <h2 className="fm-card__title">
              <PieChart size={16} aria-hidden="true" /> Para onde foi o dinheiro
            </h2>
            <ul className="fm-rows">
              {parts.map((p) => (
                <li key={p.tone}>
                  <span className="fm-rows__label">{p.label}</span>
                  <span className="fm-bar" aria-hidden="true">
                    <span style={{ width: `${p.share}%` }} />
                  </span>
                  <span className="fm-rows__pct">{p.share}%</span>
                  <strong>{formatBRL(p.value)}</strong>
                </li>
              ))}
            </ul>
            <p className="fm-note">
              Taxas de cartão estimadas em {cardFeeLabel()}% do crédito e do débito; produtos vêm do gasto mensal cadastrado em Meu site.
            </p>
          </section>

          <section className="fm-card">
            <h2 className="fm-card__title">
              <CreditCard size={16} aria-hidden="true" /> Formas de pagamento
            </h2>
            {shares.length === 0 ? (
              <p className="fm-empty">Os recebimentos aparecem quando você conclui atendimentos na agenda.</p>
            ) : (
              <ul className="fm-rows">
                {shares.map((p) => (
                  <li key={p.method}>
                    <span className="fm-rows__label">{p.method}</span>
                    <span className="fm-bar" aria-hidden="true">
                      <span style={{ width: `${p.share}%` }} />
                    </span>
                    <span className="fm-rows__pct">{p.share}%</span>
                    <strong>{formatBRL(p.total)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {showsTeam(month, professionals.length) && (
            <section className="fm-card">
              <h2 className="fm-card__title">
                <Users size={16} aria-hidden="true" /> Comissões
                {month.commissionsTotal > 0 && <span className="fm-card__aside">{formatBRL(month.commissionsTotal)}</span>}
              </h2>
              {commissionRows.length === 0 ? (
                <p className="fm-empty">Nenhuma profissional com comissão definida. Defina o percentual de cada uma para calcular.</p>
              ) : (
                <LedgerList rows={commissionRows} />
              )}
            </section>
          )}

          <section className="fm-card">
            <h2 className="fm-card__title">
              <Wallet size={16} aria-hidden="true" /> Saídas do mês
              {canLaunch && (
                <Button variant="soft" size="sm" className="fm-card__action" onClick={() => setAddingExpense(true)}>
                  <Plus size={15} aria-hidden="true" /> Lançar
                </Button>
              )}
            </h2>
            {!fin.expensesAvailable ? (
              <p className="fm-empty">As saídas ficam disponíveis assim que a atualização do banco for aplicada.</p>
            ) : expenseRows.length === 0 ? (
              <p className="fm-empty">Nenhuma saída lançada em {month.label}. Aluguel, luz e material entram aqui.</p>
            ) : (
              <LedgerList rows={expenseRows} />
            )}
          </section>
        </div>

        <aside className="fm-preview" aria-label="Prévia do recibo do mês">
          <div className="fm-preview__bar">
            <h2 className="fm-card__title">
              <FileText size={16} aria-hidden="true" /> Prévia do recibo
            </h2>
            {closedAt ? (
              <span className="fm-pill fm-pill--ok">
                <Lock size={12} aria-hidden="true" /> Fechado em {format(closedAt, 'dd/MM')}
              </span>
            ) : (
              <Button size="sm" onClick={() => setConfirming(true)}>
                <Lock size={15} aria-hidden="true" /> Fechar {month.label}
              </Button>
            )}
          </div>
          <Receipt model={buildMonthReceipt(month, closedAt, { salonName, now })} />
        </aside>
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

import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { endOfMonth, format, isSameDay, startOfDay } from 'date-fns'
import { CalendarDays, CreditCard, FileText, Lock, PieChart, Plus, Trash2, Users, Wallet } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useFinance } from '../../data/useFinance'
import {
  bestWeekIndex,
  buildDayReceipt,
  buildMonthReceipt,
  cardFeeLabel,
  composition,
  growthPct,
  isWholeMonth,
  marginPct,
  monthRange,
  paymentShares,
  showsTeam,
  weekBars,
  weeklyAverage,
  weeksOf,
  type DateRange,
  type Expense,
  type ReceiptModel,
} from '../../domain/finance'
import { DailyLine } from '../../components/charts/DailyLine'
import { LedgerList, type LedgerRow } from '../../components/finance/LedgerList'
import { Receipt } from '../../components/finance/Receipt'
import { PeriodPicker, periodLabel } from '../../components/finance/PeriodPicker'
import { ReceiptSheet } from '../../components/finance/ReceiptSheet'
import { Avatar, Button, PageHeader } from '../../components/ui'
import { formatBRL } from '../../lib/format'
import { agenda } from '../../lib/routes'
import { CloseDialog } from './CloseDialog'
import { ExpenseDialog } from './ExpenseDialog'
import './Financeiro.css'

const short = (v: number) => formatBRL(v).replace(',00', '')

/** fechamento do mês (ou de qualquer período do filtro de datas): números, detalhes à esquerda e a prévia do recibo à direita */
export function MonthView({ tabs }: { tabs: ReactNode }) {
  const { salon } = useAuth()
  const fin = useFinance()
  const { months, professionals } = fin
  const [range, setRange] = useState<DateRange>(() => monthRange(new Date()))
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

  const salonName = salon?.name ?? 'Studio Maria Beauty'
  const now = new Date()

  // mês inteiro: o fechamento de verdade (com o retrato travado); qualquer outro período é calculado na hora, sem produtos
  const whole = isWholeMonth(range)
  const picked = whole ? months.find((m) => m.id === format(range.from, 'yyyy-MM')) : undefined
  const month = picked ?? fin.periodFor(range.from, range.to)
  const partial = !picked
  const previous = picked ? months[months.indexOf(picked) - 1] : undefined
  const closedAt = picked ? (picked.closedAt ?? closedNow[picked.id] ?? null) : null
  const singleDay = isSameDay(range.from, range.to)
  // as saídas entram no mês que contém o início do período, enquanto ele não está fechado
  const launchMonth = months.find((m) => m.id === format(range.from, 'yyyy-MM'))
  const launchClosed = launchMonth ? Boolean(launchMonth.closedAt || closedNow[launchMonth.id]) : true

  const growth = partial ? null : growthPct(month, previous)
  const weeks = weekBars(weeksOf(month))
  const bestWeek = bestWeekIndex(weeks)
  const parts = composition(month)
  const shares = paymentShares(month.payments)
  const fromKey = format(range.from, 'yyyy-MM-dd')
  const toKey = format(range.to, 'yyyy-MM-dd')
  const periodExpenses = fin.expenses.filter((e) => e.date >= fromKey && e.date <= toKey)
  const professionalName = (id: string) => professionals.find((p) => p.id === id)?.name ?? 'Profissional'
  const canLaunch = Boolean(launchMonth) && !launchClosed && fin.expensesAvailable
  const canClose = whole && Boolean(picked) && !closedAt

  const closeMonth = async () => {
    if (!picked) return
    setActionError(null)
    const message = await fin.closeMonth(picked)
    if (message) setActionError(message)
    else if (!fin.live) setClosedNow((c) => ({ ...c, [picked.id]: new Date() }))
    setConfirming(false)
    setReceipt(null)
  }

  const removeExpense = async (e: Expense) => {
    setActionError(null)
    const message = await fin.removeExpense(e.id)
    if (message) setActionError(message)
  }

  const expenseRows: LedgerRow[] = periodExpenses.map((e) => ({
    id: e.id,
    lead: format(new Date(`${e.date}T12:00:00`), 'dd/MM'),
    title: e.description,
    value: formatBRL(e.amount),
    action: !launchClosed && (
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

  const trendHint = partial
    ? periodLabel(range)
    : growth !== null && !month.isCurrent
      ? `${growth >= 0 ? '+' : ''}${growth}% vs ${previous?.label ?? ''}`
      : closedAt
        ? 'Mês fechado'
        : month.isCurrent
          ? 'Mês em aberto'
          : 'Aguardando fechamento'

  // um dia só mostra o recibo do dia; qualquer outro período, o do mês (ou do período)
  const receiptModel: ReceiptModel = singleDay
    ? buildDayReceipt(fin.statementFor(fromKey), { salonName, now })
    : buildMonthReceipt(month, closedAt, { salonName, now })
  const receiptLabel = singleDay ? 'Recibo do dia' : partial ? 'Recibo do período' : 'Recibo do mês'

  return (
    <div className="page finpage">
      <PageHeader
        title={whole ? 'Fechamento mensal' : 'Resultado do período'}
        crumb={
          <>
            Financeiro <span aria-hidden="true">/</span> {periodLabel(range)}
          </>
        }
        actions={
          <>
            {tabs}
            <PeriodPicker
              value={range}
              onChange={setRange}
              today={fin.today}
              min={fin.firstDay}
              max={startOfDay(endOfMonth(fin.today))}
            />
            <Button variant="soft" size="sm" onClick={() => setReceipt(receiptModel)}>
              <FileText size={15} aria-hidden="true" /> {receiptLabel}
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
          <span className="fm-stat__hint">{month.noShows === 0 ? 'Nenhuma falta' : `${month.noShows} ${month.noShows === 1 ? 'falta' : 'faltas'}`}</span>
        </div>
      </div>

      <div className="fm-layout">
        <div className="fm-details">
          <section className="fm-card">
            <h2 className="fm-card__title">
              <CalendarDays size={16} aria-hidden="true" /> {partial ? 'Dias do período' : 'Dias do mês'}
              {month.gross > 0 && <span className="fm-card__aside">Média de {short(weeklyAverage(month))} por semana</span>}
            </h2>
            {month.gross === 0 && (
              <p className="fm-empty">
                Entra aqui conforme você conclui atendimentos. <Link to={agenda()}>Abrir agenda</Link>
              </p>
            )}
            {month.daily.length > 1 && <DailyLine values={month.daily} />}
            <ul className="fm-rows">
              {(month.daily.length > 7 ? weeks : []).map((w, i) => (
                <li key={w.label} className={w.future ? 'is-future' : undefined}>
                  <span className="fm-rows__label">
                    {w.label}
                    {i === bestWeek && w.total > 0 && <em className="fm-pill">melhor</em>}
                  </span>
                  <span className="fm-bar" aria-hidden="true">
                    <span style={{ '--w': `${w.width}%` } as CSSProperties} />
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
                    <span style={{ '--w': `${p.share}%` } as CSSProperties} />
                  </span>
                  <span className="fm-rows__pct">{p.share}%</span>
                  <strong>{formatBRL(p.value)}</strong>
                </li>
              ))}
            </ul>
            <p className="fm-note">
              Taxas de cartão estimadas em {cardFeeLabel()}% do crédito e do débito;{' '}
              {partial ? 'produtos e custos fixos entram só no fechamento do mês.' : 'produtos vêm do gasto mensal cadastrado em Meu site.'}
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
                      <span style={{ '--w': `${p.share}%` } as CSSProperties} />
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
              <Wallet size={16} aria-hidden="true" /> {partial ? 'Saídas do período' : 'Saídas do mês'}
              {canLaunch && (
                <Button variant="soft" size="sm" className="fm-card__action" onClick={() => setAddingExpense(true)}>
                  <Plus size={15} aria-hidden="true" /> Lançar
                </Button>
              )}
            </h2>
            {!fin.expensesAvailable ? (
              <p className="fm-empty">As saídas ficam disponíveis assim que a atualização do banco for aplicada.</p>
            ) : expenseRows.length === 0 ? (
              <p className="fm-empty">Nenhuma saída lançada {partial ? 'neste período' : `em ${month.label}`}. Aluguel, luz e material entram aqui.</p>
            ) : (
              <LedgerList rows={expenseRows} />
            )}
          </section>
        </div>

        <aside className="fm-preview" aria-label="Prévia do recibo">
          <div className="fm-preview__bar">
            <h2 className="fm-card__title">
              <FileText size={16} aria-hidden="true" /> Prévia do recibo
            </h2>
            {!whole ? (
              <span className="fm-pill">Só o mês inteiro fecha</span>
            ) : closedAt ? (
              <span className="fm-pill fm-pill--ok">
                <Lock size={12} aria-hidden="true" /> Fechado em {format(closedAt, 'dd/MM')}
              </span>
            ) : (
              <Button size="sm" onClick={() => setConfirming(true)}>
                <Lock size={15} aria-hidden="true" /> Fechar {month.label}
              </Button>
            )}
          </div>
          <Receipt model={receiptModel} />
        </aside>
      </div>

      {addingExpense && launchMonth && <ExpenseDialog month={launchMonth} onSave={fin.addExpense} onClose={() => setAddingExpense(false)} />}
      {confirming && picked && <CloseDialog month={picked} onCancel={() => setConfirming(false)} onConfirm={() => void closeMonth()} />}
      {receipt && (
        <ReceiptSheet
          model={receipt}
          onClose={() => setReceipt(null)}
          extra={
            receipt.kind === 'month' &&
            canClose && (
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

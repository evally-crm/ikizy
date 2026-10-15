import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { addDays, endOfMonth, format, isSameDay, startOfDay } from 'date-fns'
import { CalendarCheck, CalendarDays, ChartColumn, ChevronRight, CreditCard, FileText, Lock, PieChart, PiggyBank, Plus, Trash2, TrendingUp, Users, Wallet } from 'lucide-react'
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
import { PaymentColumns } from '../../components/charts/PaymentColumns'
import { WeeklyBars } from '../../components/charts/WeeklyBars'
import { LedgerList, type LedgerRow } from '../../components/finance/LedgerList'
import { Invoice } from '../../components/finance/Invoice'
import { PeriodPicker, periodLabel } from '../../components/finance/PeriodPicker'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { ReceiptSheet } from '../../components/finance/ReceiptSheet'
import { Avatar, Button, PageHeader } from '../../components/ui'
import { formatBRL } from '../../lib/format'
import { agenda } from '../../lib/routes'
import { PageLoader } from '../../components/PageLoader'
import { CloseDialog } from './CloseDialog'
import { ExpenseDialog } from './ExpenseDialog'
import { FinChart, FinSheet } from './FinSheet'
import './Financeiro.css'

const short = (v: number) => formatBRL(v).replace(',00', '')

type Detail = 'gross' | 'net' | 'appts' | 'days' | 'weeks' | 'pay' | 'where' | 'team'

/** intensidade da pílula do dia (0 = sem movimento, 1 a 4 = cada vez mais forte; `future` = ainda não chegou) */
const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const heatLevel = (v: number | null, max: number) => (v === null ? 'future' : v <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((v / max) * 4)))

/** selo de variação: verde subindo, vermelho caindo */
function Delta({ value }: { value: number }) {
  return <span className={`fb-delta ${value < 0 ? 'fb-delta--down' : ''}`.trim()}>{`${value >= 0 ? '+' : ''}${value}%`}</span>
}

/** fechamento do mês (ou de qualquer período do filtro de datas): números, detalhes à esquerda e a prévia do recibo à direita */
export function MonthView({ tabs }: { tabs: ReactNode }) {
  const { salon } = useAuth()
  const fin = useFinance()
  const { months, professionals } = fin
  const [range, setRange] = useState<DateRange>(() => monthRange(new Date()))
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [closedNow, setClosedNow] = useState<Record<string, Date>>({})
  const [confirming, setConfirming] = useState(false)
  const [addingExpense, setAddingExpense] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptModel | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // detalhe aberto; `shown` segura o conteúdo enquanto a folha some
  const [detail, setDetail] = useState<Detail | null>(null)
  const [shown, setShown] = useState<Detail>('gross')
  const openDetail = (d: Detail) => {
    setShown(d)
    setDetail(d)
  }

  // carregando: título e seletor ficam no lugar; embaixo, o logo pulsando e a silhueta dos blocos
  if (fin.loading) {
    return (
      <div className="page page--fit finpage">
        <PageHeader title={isMobile ? 'Financeiro' : 'Fechamento mensal'} actions={!isMobile && tabs} />
        {isMobile && tabs}
        <PageLoader label="Carregando o financeiro do mês…" blocks={5} />
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
  // mês em andamento e sem nenhum atendimento: nada para fechar ainda
  const nothingToClose = month.isCurrent && month.gross === 0 && month.appointments === 0

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
  const dayMax = Math.max(0, ...month.daily.map((v) => v ?? 0))
  // o mapa começa na segunda: casas vazias até o dia da semana do primeiro dia
  const heatLead = (range.from.getDay() + 6) % 7
  const topShare = shares[0]
  const sheetHead: Record<Detail, { value: string; label: string; text?: string }> = {
    gross: { value: formatBRL(month.gross), label: 'faturamento bruto', text: trendHint },
    net: { value: formatBRL(month.net), label: 'lucro líquido', text: `Margem de ${marginPct(month)}% depois de comissões, produtos, despesas e taxas.` },
    appts: { value: String(month.appointments), label: month.appointments === 1 ? 'atendimento' : 'atendimentos', text: `Ticket médio de ${formatBRL(month.ticket)}.` },
    days: { value: short(weeklyAverage(month)), label: 'por semana, em média', text: month.gross > 0 ? `${formatBRL(month.gross)} no total.` : trendHint },
    weeks: {
      value: bestWeek >= 0 ? formatBRL(weeks[bestWeek].total) : formatBRL(0),
      label: bestWeek >= 0 ? `na melhor semana (${weeks[bestWeek].label})` : 'sem movimento ainda',
    },
    pay: { value: topShare ? `${topShare.share}%` : '—', label: topShare ? `em ${topShare.method}` : 'nenhum recebimento ainda' },
    where: { value: formatBRL(month.gross), label: 'entraram no período', text: `Sobrou ${formatBRL(Math.max(month.net, 0))} de lucro.` },
    team: { value: formatBRL(month.commissionsTotal), label: 'em comissões' },
  }
  const receiptLabel = singleDay ? 'Recibo do dia' : partial ? 'Recibo do período' : 'Recibo do mês'

  return (
    <div className="page finpage">
      {isMobile ? (
        <>
          <PageHeader
            title="Financeiro"
            // o botão fica sempre no lugar (só desabilita) para o título não pular enquanto os dados carregam
            actions={
              <Button size="sm" disabled={!canLaunch} onClick={() => setAddingExpense(true)}>
                <Plus size={15} aria-hidden="true" /> Saída
              </Button>
            }
          />
          {tabs}
        </>
      ) : (
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
              <Button size="sm" disabled={!canLaunch} onClick={() => setAddingExpense(true)}>
                <Plus size={15} aria-hidden="true" /> Nova saída
              </Button>
            </>
          }
        />
      )}

      {(fin.error || actionError) && (
        <p className="dialog__error" role="alert">
          {actionError ?? fin.error}
        </p>
      )}

      <div className="fm-layout">
        <div className="fm-details fb">
          {/* três números do mês: tocar abre o detalhe com o gráfico */}
          <div className="fb-tiles">
            <button type="button" className="fb-tile" onClick={() => openDetail('gross')}>
              <span className="fb-tile__top">
                <TrendingUp size={16} aria-hidden="true" />
                {growth !== null && !partial && <Delta value={growth} />}
              </span>
              <strong>{short(month.gross)}</strong>
              <small>faturamento</small>
            </button>
            <button type="button" className="fb-tile" onClick={() => openDetail('net')}>
              <span className="fb-tile__top">
                <PiggyBank size={16} aria-hidden="true" />
                <span className="fb-delta">{marginPct(month)}%</span>
              </span>
              <strong>{short(month.net)}</strong>
              <small>lucro</small>
            </button>
            <button type="button" className="fb-tile" onClick={() => openDetail('appts')}>
              <span className="fb-tile__top">
                <CalendarCheck size={16} aria-hidden="true" />
                {month.noShows > 0 && <span className="fb-delta fb-delta--down">{month.noShows} faltas</span>}
              </span>
              <strong>{month.appointments}</strong>
              <small>atendimentos</small>
            </button>
          </div>

          {/* dias do mês em pílulas, mais forte onde entrou mais dinheiro */}
          <button type="button" className="fb-card fb-days" onClick={() => openDetail('days')}>
            <span className="fb-card__head">
              <span>
                <CalendarDays size={14} aria-hidden="true" /> {partial ? 'Dias do período' : 'Dias do mês'}
              </span>
              <small>{month.gross > 0 ? `${short(weeklyAverage(month))} por semana` : trendHint}</small>
            </span>
            <span className="fb-heat" aria-hidden="true">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="fb-heat__weekday">
                  {w}
                </span>
              ))}
              {Array.from({ length: heatLead }, (_, i) => (
                <span key={`lead-${i}`} />
              ))}
              {month.daily.map((v, i) => (
                <span key={i} className={`fb-heat__day fb-heat__day--${heatLevel(v, dayMax)}`}>
                  {addDays(range.from, i).getDate()}
                </span>
              ))}
            </span>
          </button>

          <div className="fb-pair">
            <button type="button" className="fb-card fb-mini" onClick={() => openDetail('weeks')}>
              <span className="fb-card__head">
                <span>
                  <ChartColumn size={14} aria-hidden="true" /> Semanas
                </span>
              </span>
              <strong className="fb-mini__value">{bestWeek >= 0 ? short(weeks[bestWeek].total) : short(0)}</strong>
              <small className="fb-mini__hint">{bestWeek >= 0 ? `melhor: ${weeks[bestWeek].label}` : 'sem movimento ainda'}</small>
              <span className="fb-minibars" aria-hidden="true">
                {weeks.map((w) => (
                  <span key={w.label} className={w.future ? 'is-future' : undefined} style={{ '--h': `${Math.max(w.width, 6)}%` } as CSSProperties} />
                ))}
              </span>
            </button>
            <button type="button" className="fb-card fb-mini" onClick={() => openDetail('pay')}>
              <span className="fb-card__head">
                <span>
                  <CreditCard size={14} aria-hidden="true" /> Pagamentos
                </span>
              </span>
              <strong className="fb-mini__value">{topShare ? `${topShare.share}%` : '—'}</strong>
              <small className="fb-mini__hint">{topShare ? `em ${topShare.method}` : 'nenhum recebimento'}</small>
              <span className="fb-split" aria-hidden="true">
                {shares.map((p) => (
                  <span key={p.method} style={{ '--w': `${p.share}%` } as CSSProperties} />
                ))}
              </span>
            </button>
          </div>

          {/* para onde foi: barra única dividida, toque para ver cada parte */}
          <button type="button" className="fb-card fb-row" onClick={() => openDetail('where')}>
            <span className="fb-card__head">
              <span>
                <PieChart size={14} aria-hidden="true" /> Para onde foi o dinheiro
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </span>
            <span className="fb-stack" aria-hidden="true">
              {parts.map((p) => (
                <span key={p.tone} className={`fb-tone--${p.tone}`} style={{ '--w': `${p.share}%` } as CSSProperties} />
              ))}
            </span>
            <span className="fb-legend">
              {parts
                .filter((p) => p.share > 0)
                .map((p) => (
                  <span key={p.tone}>
                    <i className={`fb-tone--${p.tone}`} aria-hidden="true" /> {p.label} {p.share}%
                  </span>
                ))}
            </span>
          </button>

          {showsTeam(month, professionals.length) && (
            <button type="button" className="fb-card fb-row" onClick={() => openDetail('team')}>
              <span className="fb-card__head">
                <span>
                  <Users size={14} aria-hidden="true" /> Comissões
                </span>
                <span className="fb-row__end">
                  {formatBRL(month.commissionsTotal)} <ChevronRight size={16} aria-hidden="true" />
                </span>
              </span>
            </button>
          )}

          <section className="fb-card fb-expenses">
            <span className="fb-card__head">
              <span>
                <Wallet size={14} aria-hidden="true" /> {partial ? 'Saídas do período' : 'Saídas do mês'}
              </span>
              {canLaunch && (
                <Button variant="soft" size="sm" onClick={() => setAddingExpense(true)}>
                  <Plus size={15} aria-hidden="true" /> Lançar
                </Button>
              )}
            </span>
            {!fin.expensesAvailable ? (
              <p className="fm-empty">As saídas ficam disponíveis assim que a atualização do banco for aplicada.</p>
            ) : expenseRows.length === 0 ? (
              <p className="fm-empty">
                Nenhuma saída lançada {partial ? 'neste período' : `em ${month.label}`}. Aluguel, luz e material entram aqui.
              </p>
            ) : (
              <LedgerList rows={expenseRows} />
            )}
          </section>

          {month.gross === 0 && (
            <p className="fm-empty">
              Os números entram conforme você conclui atendimentos.{' '}
              <Link to={agenda()} className="textlink">
                Abrir agenda
              </Link>
            </p>
          )}
        </div>

        <aside className="fm-preview" aria-label="Prévia da nota">
          <div className="fm-preview__bar">
            <h2 className="fm-card__title">
              <FileText size={16} aria-hidden="true" /> Prévia da nota
            </h2>
            {!whole ? (
              <span className="fm-pill">Só o mês inteiro fecha</span>
            ) : closedAt ? (
              <span className="fm-pill fm-pill--ok">
                <Lock size={12} aria-hidden="true" /> Fechado em {format(closedAt, 'dd/MM')}
              </span>
            ) : (
              <Button
                size="sm"
                disabled={nothingToClose}
                title={nothingToClose ? 'Disponível depois do primeiro atendimento do mês' : undefined}
                onClick={() => setConfirming(true)}
              >
                <Lock size={15} aria-hidden="true" /> Fechar {month.label}
              </Button>
            )}
          </div>
          <div className="fm-preview__doc">
            <Invoice model={receiptModel} />
          </div>
        </aside>
      </div>

      <FinSheet open={detail !== null} kicker={periodLabel(range)} onClose={() => setDetail(null)} {...sheetHead[shown]}>
        {(shown === 'gross' || shown === 'days') && month.daily.length > 1 && (
          <FinChart title="Dia a dia" icon={<CalendarDays size={14} aria-hidden="true" />}>
            <DailyLine values={month.daily} />
          </FinChart>
        )}
        {(shown === 'gross' || shown === 'weeks' || shown === 'days') && weeks.length > 0 && (
          <FinChart title="Por semana" icon={<ChartColumn size={14} aria-hidden="true" />}>
            <WeeklyBars weeks={weeks} bestIndex={bestWeek} label={`Faturamento por semana em ${month.label}`} />
          </FinChart>
        )}
        {(shown === 'net' || shown === 'where') && (
          <FinChart title="Para onde foi o dinheiro" icon={<PieChart size={14} aria-hidden="true" />}>
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
              {partial ? 'produtos e custos fixos entram só no fechamento do mês.' : 'produtos vêm do gasto mensal cadastrado.'}
            </p>
          </FinChart>
        )}
        {shown === 'appts' && (
          <FinChart title="Clientes" icon={<Users size={14} aria-hidden="true" />}>
            <ul className="finsheet__facts">
              <li>
                <span>Ticket médio</span>
                <strong>{formatBRL(month.ticket)}</strong>
              </li>
              <li>
                <span>Clientes novas</span>
                <strong>{month.newClients}</strong>
              </li>
              <li>
                <span>Voltaram</span>
                <strong>{month.returnRate}%</strong>
              </li>
              <li>
                <span>Faltas</span>
                <strong>{month.noShows}</strong>
              </li>
            </ul>
          </FinChart>
        )}
        {shown === 'pay' &&
          (shares.length === 0 ? (
            <p className="fm-empty">Os recebimentos aparecem quando você conclui atendimentos na agenda.</p>
          ) : (
            <FinChart title="Formas de pagamento" icon={<CreditCard size={14} aria-hidden="true" />}>
              <PaymentColumns shares={shares} />
            </FinChart>
          ))}
        {shown === 'team' &&
          (commissionRows.length === 0 ? (
            <p className="fm-empty">Nenhuma profissional com comissão definida. Defina o percentual de cada uma para calcular.</p>
          ) : (
            <FinChart title="Por profissional" icon={<Users size={14} aria-hidden="true" />}>
              <LedgerList rows={commissionRows} />
            </FinChart>
          ))}
      </FinSheet>

      {addingExpense && launchMonth && (
        <ExpenseDialog month={launchMonth} onSave={fin.addExpense} onClose={() => setAddingExpense(false)} />
      )}
      {confirming && picked && <CloseDialog month={picked} onCancel={() => setConfirming(false)} onConfirm={() => void closeMonth()} />}
      {receipt && (
        <ReceiptSheet
          model={receipt}
          onClose={() => setReceipt(null)}
          extra={
            receipt.kind === 'month' &&
            canClose && (
              <Button size="sm" disabled={nothingToClose} onClick={() => setConfirming(true)}>
                <Lock size={15} aria-hidden="true" /> Fechar {month.label}
              </Button>
            )
          }
        />
      )}
    </div>
  )
}

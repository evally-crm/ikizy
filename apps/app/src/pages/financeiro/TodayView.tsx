import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowDownLeft, CreditCard, Download, FileText, Plus, RotateCcw, Send, Wallet } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useAgenda } from '../../data/AgendaProvider'
import { useFinance } from '../../data/useFinance'
import { buildDayCash, buildDayReceipt, methodLabel, paymentShares, receiptSummaryText, type ReceiptModel } from '../../domain/finance'
import { LedgerList, type LedgerRow } from '../../components/finance/LedgerList'
import { Invoice } from '../../components/finance/Invoice'
import { ReceiptPrinter } from '../../components/finance/ReceiptPrinter'
import { ReceiptSheet } from '../../components/finance/ReceiptSheet'
import { Button, Em, PageHeader } from '../../components/ui'
import { useMediaQuery } from '../../hooks/useMediaQuery'
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
  const [printKey, setPrintKey] = useState(0)
  const isMobile = useMediaQuery('(max-width: 767px)')

  const now = useMemo(() => new Date(), [])
  const today = format(now, 'yyyy-MM-dd')
  const salonName = salon?.name ?? 'Studio Maria Beauty'
  const cash = useMemo(() => buildDayCash(today, appointments, fin.expenses), [today, appointments, fin.expenses])
  const currentMonth = fin.months[fin.months.length - 1]
  const statement = fin.statementFor(today)
  const dayReceipt = buildDayReceipt(statement, { salonName, now })
  const shares = paymentShares(cash.byMethod.map((m) => ({ method: m.label, total: m.total })))
  const canLaunch = fin.expensesAvailable && Boolean(currentMonth) && !currentMonth?.closedAt

  // /dashboard/financeiro?saida=1 abre o lançamento de saída (atalho do [+] da barra de baixo)
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    if (params.get('saida') !== '1' || fin.loading) return
    if (canLaunch) setAdding(true)
    setParams({}, { replace: true })
  }, [params, setParams, canLaunch, fin.loading])
  const proName = (id: string) => (professionals.length > 1 ? (professionals.find((p) => p.id === id)?.name ?? '') : '')

  const receivedRows: LedgerRow[] = cash.received.map((a) => ({
    id: a.id,
    lead: formatTime(a.start),
    title: a.client,
    subtitle: [a.service, proName(a.professionalId), methodLabel(a.paymentMethod ?? 'nao')].filter(Boolean).join(' · '),
    value: formatBRL(a.price),
  }))
  const expenseRows: LedgerRow[] = cash.expenses.map((e) => ({
    id: e.id,
    title: e.description,
    value: `− ${formatBRL(e.amount)}`,
  }))

  return (
    <div className="page finpage">
      {isMobile ? (
        <PageHeader
          title="Financeiro"
          // o botão fica sempre no lugar (só desabilita) para o título não pular enquanto os dados carregam
          actions={
            <Button size="sm" disabled={!canLaunch} onClick={() => setAdding(true)}>
              <Plus size={15} aria-hidden="true" /> Saída
            </Button>
          }
        />
      ) : (
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
              <Button variant="soft" size="sm" onClick={() => setReceipt(dayReceipt)}>
                <FileText size={15} aria-hidden="true" /> Nota de hoje
              </Button>
              <Button size="sm" disabled={!canLaunch} onClick={() => setAdding(true)}>
                <Plus size={15} aria-hidden="true" /> Saída
              </Button>
            </>
          }
        />
      )}

      {isMobile ? (
        <div className="fm-ticket">
          {tabs}
          <ReceiptPrinter model={dayReceipt} printKey={printKey} />
          {cash.toReceive.length > 0 && (
            <p className="fm-ticket__note">
              Faltam {cash.toReceive.length} por concluir ({formatBRL(cash.expected)}) ·{' '}
              <Link to={agenda()} className="textlink">
                abrir agenda
              </Link>
            </p>
          )}
          <div className="fm-ticket__actions">
            <Button variant="soft" size="sm" onClick={() => setPrintKey((k) => k + 1)}>
              <RotateCcw size={15} aria-hidden="true" /> Imprimir de novo
            </Button>
            <Button variant="soft" size="sm" onClick={() => window.print()}>
              <Download size={15} aria-hidden="true" /> PDF
            </Button>
            <a
              className="btn btn--soft btn--sm"
              href={`https://wa.me/?text=${encodeURIComponent(receiptSummaryText(dayReceipt))}`}
              target="_blank"
              rel="noreferrer"
            >
              <Send size={15} aria-hidden="true" /> WhatsApp
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="fm-stats">
            <div className="fm-stat fm-stat--dark">
              <span className="fm-stat__label">Recebido hoje</span>
              <strong className="fm-stat__value">{formatBRL(cash.total)}</strong>
              <span className="fm-stat__hint">
                {cash.received.length} {cash.received.length === 1 ? 'atendimento concluído' : 'atendimentos concluídos'}
              </span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">A receber hoje</span>
              <strong className="fm-stat__value">{formatBRL(cash.expected)}</strong>
              <span className="fm-stat__hint">
                {cash.toReceive.length === 0 ? (
                  'Nada mais previsto para hoje'
                ) : (
                  <>
                    {cash.toReceive.length} por concluir ·{' '}
                    <Link to={agenda()} className="textlink">
                      abrir agenda
                    </Link>
                  </>
                )}
              </span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">Saídas de hoje</span>
              <strong className="fm-stat__value">{formatBRL(cash.expensesTotal)}</strong>
              <span className="fm-stat__hint">
                {cash.expenses.length === 0
                  ? 'Nenhuma saída lançada'
                  : `${cash.expenses.length} ${cash.expenses.length === 1 ? 'lançamento' : 'lançamentos'}`}
              </span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">Resultado do dia</span>
              <strong className="fm-stat__value">{formatBRL(statement.net)}</strong>
              <span className="fm-stat__hint">Depois de comissões, taxas e saídas</span>
            </div>
          </div>

          <div className="fm-layout">
            <div className="fm-details">
              <section className="fm-card">
                <h2 className="fm-card__title">
                  <CreditCard size={16} aria-hidden="true" /> Formas de pagamento
                </h2>
                {shares.length === 0 ? (
                  <p className="fm-empty">Aparecem quando você conclui atendimentos na agenda.</p>
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

              <section className="fm-card">
                <h2 className="fm-card__title">
                  <Wallet size={16} aria-hidden="true" /> Saídas de hoje
                  {canLaunch && (
                    <Button variant="soft" size="sm" className="fm-card__action" onClick={() => setAdding(true)}>
                      <Plus size={15} aria-hidden="true" /> Lançar
                    </Button>
                  )}
                </h2>
                {expenseRows.length === 0 ? <p className="fm-empty">Nenhuma saída lançada hoje.</p> : <LedgerList rows={expenseRows} />}
              </section>

              <section className="fm-card fm-card--wide">
                <h2 className="fm-card__title">
                  <ArrowDownLeft size={16} aria-hidden="true" /> Recebimentos de hoje
                </h2>
                {receivedRows.length === 0 ? (
                  <p className="fm-empty">
                    Os recebimentos aparecem quando você conclui atendimentos.{' '}
                    <Link to={agenda()} className="textlink">
                      Abrir agenda
                    </Link>
                  </p>
                ) : (
                  <LedgerList rows={receivedRows} />
                )}
              </section>
            </div>

            <aside className="fm-preview" aria-label="Prévia da nota de hoje">
              <div className="fm-preview__bar">
                <h2 className="fm-card__title">
                  <FileText size={16} aria-hidden="true" /> Nota de hoje
                </h2>
                <Button variant="soft" size="sm" onClick={() => setReceipt(dayReceipt)}>
                  Abrir
                </Button>
              </div>
              <div className="fm-preview__doc">
                <Invoice model={dayReceipt} />
              </div>
            </aside>
          </div>
        </>
      )}

      {adding && currentMonth && <ExpenseDialog month={currentMonth} onSave={fin.addExpense} onClose={() => setAdding(false)} />}
      {receipt && <ReceiptSheet model={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}

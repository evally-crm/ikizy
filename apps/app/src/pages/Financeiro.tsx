import { useEffect, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Download, Lock, Plus, Send, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { type MonthClosing } from '../data/finance'
import { CARD_FEE_PCT, useFinance, type Expense } from '../data/useFinance'
import { formatBRL } from '../lib/format'
import { Avatar, Button, Card, Em, Money } from '../components/ui'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)

/** gráfico de linha do faturamento diário, no estilo "batimentos" do recibo */
function DailyLine({ daily }: { daily: (number | null)[] }) {
  const values = daily.filter((v): v is number => v !== null)
  const max = Math.max(...values, 1)
  const w = 300
  const h = 70
  const step = w / Math.max(daily.length - 1, 1)
  const points = daily
    .map((v, i) => (v === null ? null : `${(i * step).toFixed(1)},${(h - (v / max) * (h - 6) - 3).toFixed(1)}`))
    .filter(Boolean)
    .join(' ')
  return (
    <svg className="receipt__chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {[0.25, 0.5, 0.75].map((y) => (
        <line key={y} x1="0" x2={w} y1={h * y} y2={h * y} className="receipt__grid" />
      ))}
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Receipt({ month, closedAt, salonName }: { month: MonthClosing; closedAt: Date | null; salonName: string }) {
  const days = month.daily.map((v, i) => ({ v, i })).filter((d) => d.v !== null) as { v: number; i: number }[]
  const bestDay = days.reduce((a, b) => (b.v > a.v ? b : a), days[0] ?? { v: 0, i: 0 })
  const bestDate = new Date(month.date.getFullYear(), month.date.getMonth(), bestDay.i + 1)
  const values = days.map((d) => d.v)
  const open = values.filter((v) => v > 0)
  const range = open.length ? [Math.min(...open), Math.max(...open)] : [0, 0]
  const short = (v: number) => formatBRL(v).replace(',00', '')

  return (
    <article className="receipt" aria-label={`Recibo de fechamento de ${month.label}`}>
      <div className="receipt__paper">
        {closedAt && (
          <span className="receipt__stamp" aria-hidden="true">
            Fechado
          </span>
        )}
        <header className="receipt__head">
          <p className="receipt__logo">
            IKIZY<span>.</span>
          </p>
          <p className="receipt__title">Recibo do mês</p>
          <p>Nº {month.id.replace('-', '')}</p>
          <p>
            {format(month.date, 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
          </p>
          <p>{salonName}</p>
          {!closedAt && <p className="receipt__preview">Prévia · mês em aberto</p>}
        </header>

        <hr />
        <table className="receipt__table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qtd</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {month.categories.map((c, i) => (
              <tr key={c.name}>
                <td>
                  {i + 1}. {c.name}
                </td>
                <td>{c.qty}</td>
                <td>{formatBRL(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr />
        <dl className="receipt__sums">
          <div>
            <dt>Faturamento bruto</dt>
            <dd>{formatBRL(month.gross)}</dd>
          </div>
          <div>
            <dt>(-) Comissões</dt>
            <dd>{formatBRL(month.commissionsTotal)}</dd>
          </div>
          <div>
            <dt>(-) Produtos</dt>
            <dd>{formatBRL(month.products)}</dd>
          </div>
          {month.expenses > 0 && (
            <div>
              <dt>(-) Despesas</dt>
              <dd>{formatBRL(month.expenses)}</dd>
            </div>
          )}
          <div>
            <dt>(-) Taxas de cartão</dt>
            <dd>{formatBRL(month.cardFees)}</dd>
          </div>
          <div className="receipt__total">
            <dt>Lucro líquido</dt>
            <dd>{formatBRL(month.net)}</dd>
          </div>
        </dl>

        <hr />
        <dl className="receipt__stats">
          <div>
            <dt>Atendimentos</dt>
            <dd>{month.appointments}</dd>
          </div>
          <div>
            <dt>Ticket médio</dt>
            <dd>{formatBRL(month.ticket)}</dd>
          </div>
          <div>
            <dt>Novas clientes</dt>
            <dd>{month.newClients}</dd>
          </div>
          <div>
            <dt>Retorno</dt>
            <dd>{month.returnRate}%</dd>
          </div>
          <div>
            <dt>Faltas</dt>
            <dd>{month.noShows}</dd>
          </div>
        </dl>

        <hr />
        <div className="receipt__chart-head">
          <span>Faturamento diário</span>
          <span>
            {short(range[0])} – {short(range[1])}
          </span>
        </div>
        <DailyLine daily={month.daily} />
        {days.length > 0 && (
          <p className="receipt__best">
            Melhor dia: {format(bestDate, "EEE dd", { locale: ptBR }).replace('.', '')} · {formatBRL(bestDay.v)}
          </p>
        )}

        <hr />
        <footer className="receipt__foot">
          {closedAt ? (
            <p>Fechado em {format(closedAt, "dd/MM/yyyy 'às' HH:mm")}</p>
          ) : (
            <p>Valores parciais até {format(new Date(), 'dd/MM')}</p>
          )}
          <p>Obrigada por cuidar de quem cuida ♥</p>
          <div className="receipt__barcode" aria-hidden="true" />
        </footer>
      </div>
    </article>
  )
}

function CloseDialog({ month, onCancel, onConfirm }: { month: MonthClosing; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Fechar ${month.label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__head">
          <div>
            <p className="eyebrow">Fechamento</p>
            <h2>
              Fechar <Em>{month.label}</Em>?
            </h2>
          </div>
          <Button variant="ghost" size="sm" icon aria-label="Cancelar" onClick={onCancel}>
            <X size={18} />
          </Button>
        </div>
        <dl className="dialog__grid">
          <div>
            <dt>Faturamento bruto</dt>
            <dd>{formatBRL(month.gross)}</dd>
          </div>
          <div>
            <dt>Lucro líquido</dt>
            <dd>{formatBRL(month.net)}</dd>
          </div>
          <div>
            <dt>Comissões a pagar</dt>
            <dd>{formatBRL(month.commissionsTotal)}</dd>
          </div>
          <div>
            <dt>Atendimentos</dt>
            <dd>{month.appointments}</dd>
          </div>
        </dl>
        <p className="dialog__text">
          Ao fechar, os atendimentos e as saídas de {month.label} ficam travados e o recibo guarda estes números. Não dá para desfazer.
          {month.isCurrent && month.elapsedDays < month.daysInMonth && ' Atenção: o mês ainda não terminou.'}
        </p>
        <div className="dialog__actions">
          <Button variant="ghost" onClick={onCancel}>
            Agora não
          </Button>
          <Button onClick={onConfirm}>
            <Lock size={16} aria-hidden="true" /> Fechar mês
          </Button>
        </div>
      </div>
    </div>
  )
}

function ExpenseDialog({
  month,
  onSave,
  onClose,
}: {
  month: MonthClosing
  onSave: (input: { date: string; description: string; amount: number }) => Promise<string | null>
  onClose: () => void
}) {
  const monthStart = format(month.date, 'yyyy-MM-01')
  const defaultDate = month.isCurrent
    ? format(new Date(), 'yyyy-MM-dd')
    : format(new Date(month.date.getFullYear(), month.date.getMonth() + 1, 0), 'yyyy-MM-dd')
  const [date, setDate] = useState(defaultDate)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = Number(amount.replace(/\./g, '').replace(',', '.'))
    if (!description.trim()) return setError('Descreva a saída.')
    if (!Number.isFinite(value) || value <= 0) return setError('Informe um valor maior que zero.')
    if (!date.startsWith(monthStart.slice(0, 7))) return setError(`A data precisa estar em ${month.label}.`)
    setBusy(true)
    const message = await onSave({ date, description: description.trim(), amount: value })
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog" role="dialog" aria-modal="true" aria-label="Nova saída" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="dialog__head">
          <h2>
            Nova <Em>saída</Em>
          </h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="form">
          <label className="field">
            <span className="field__label">Descrição</span>
            <span className="input">
              <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={80} placeholder="Aluguel, esmaltes, luz…" autoFocus />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Valor</span>
            <span className="input">
              <span className="wiz__cur">R$</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ''))} inputMode="decimal" placeholder="0,00" />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Data</span>
            <span className="input">
              <input type="date" value={date} min={monthStart} onChange={(e) => setDate(e.target.value)} />
            </span>
          </label>
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button variant="light" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Lançar saída'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function Financeiro() {
  const { salon } = useAuth()
  const fin = useFinance()
  const { months, professionals } = fin
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [closedNow, setClosedNow] = useState<Record<string, Date>>({})
  const [confirming, setConfirming] = useState(false)
  const [addingExpense, setAddingExpense] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (fin.loading) {
    return (
      <div className="page">
        <p className="crm__empty" role="status">
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
  const prev = months[months.indexOf(month) - 1]
  const closedAt = month.closedAt ?? closedNow[month.id] ?? null
  const growth = prev && prev.gross ? Math.round(((month.gross - prev.gross) / prev.gross) * 100) : null
  const monthExpenses = fin.expenses.filter((e) => e.date.startsWith(month.id))
  const salonName = salon?.name ?? 'Studio Maria Beauty'

  const composition = [
    { label: 'Lucro', value: Math.max(month.net, 0), cls: 'is-net' },
    { label: 'Comissões', value: month.commissionsTotal, cls: 'is-comm' },
    { label: 'Produtos', value: month.products, cls: 'is-prod' },
    { label: 'Despesas', value: month.expenses, cls: 'is-exp' },
    { label: 'Taxas', value: month.cardFees, cls: 'is-fee' },
  ].filter((c) => c.value > 0 || c.cls === 'is-net')
  const maxPayment = Math.max(...month.payments.map((p) => p.total), 1)
  const summary = `Fechamento de ${month.label} - ${salonName}\nFaturamento: ${formatBRL(month.gross)}\nLucro líquido: ${formatBRL(month.net)}\nAtendimentos: ${month.appointments}`

  const onClose = async () => {
    setActionError(null)
    const message = await fin.closeMonth(month)
    if (message) setActionError(message)
    else if (!fin.live) setClosedNow((c) => ({ ...c, [month.id]: new Date() }))
    setConfirming(false)
  }

  const onRemove = async (e: Expense) => {
    setActionError(null)
    const message = await fin.removeExpense(e.id)
    if (message) setActionError(message)
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="hero__hello">Financeiro</p>
          <h1 className="hero__title">
            Fechamento <Em>mensal</Em>
          </h1>
        </div>
        <div className="chips" role="tablist" aria-label="Mês">
          {months.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              className="chip"
              aria-selected={m.id === month.id}
              onClick={() => setSelectedId(m.id)}
            >
              {cap(m.label)}
              {(m.closedAt || closedNow[m.id]) && <Lock size={12} aria-label="fechado" />}
            </button>
          ))}
        </div>
      </header>

      {(fin.error || actionError) && (
        <p className="dialog__error" role="alert">
          {actionError ?? fin.error}
        </p>
      )}

      <section className="kpis" aria-label={`Resumo de ${month.label}`}>
        <div className="kpi">
          <span className="kpi__label">
            Faturamento bruto{' '}
            {growth !== null && !month.isCurrent && (
              <span className={`badge ${growth >= 0 ? 'badge--up' : 'badge--pendente'}`}>
                {growth >= 0 ? '+' : ''}
                {growth}%
              </span>
            )}
          </span>
          <Money value={month.gross} size="xl" />
        </div>
        <div className="kpi">
          <span className="kpi__label">Lucro líquido</span>
          <Money value={month.net} size="lg" />
        </div>
        <div className="kpi">
          <span className="kpi__label">Ticket médio</span>
          <Money value={month.ticket} size="lg" />
        </div>
        <div className="kpi">
          <span className="kpi__label">Atendimentos</span>
          <span className="kpi__plain">{month.appointments}</span>
        </div>
      </section>

      <div className="fin">
        <div className="fin__receipt">
          <Receipt month={month} closedAt={closedAt} salonName={salonName} />
          <div className="receipt__actions">
            <Button variant="soft" onClick={() => window.print()}>
              <Download size={16} aria-hidden="true" /> Baixar PDF
            </Button>
            <a className="btn btn--soft" href={`https://wa.me/?text=${encodeURIComponent(summary)}`} target="_blank" rel="noreferrer">
              <Send size={16} aria-hidden="true" /> Enviar no WhatsApp
            </a>
          </div>
        </div>

        <div className="fin__side">
          {closedAt ? (
            <Card className="closecta closecta--done">
              <Lock size={20} aria-hidden="true" />
              <div>
                <h2 className="card__title">{cap(month.label)} está fechado</h2>
                <p className="card__sub">Fechado em {format(closedAt, "dd/MM 'às' HH:mm")}. Os números não mudam mais.</p>
              </div>
            </Card>
          ) : (
            <Card variant="brand" className="closecta">
              <div>
                <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {month.isCurrent ? `${month.daysInMonth - month.elapsedDays} dias para o fim do mês` : 'Mês já terminou'}
                </p>
                <h2 className="closecta__title">
                  Pronta para fechar <Em>{month.label}</Em>?
                </h2>
                <p className="closecta__text">Confira o recibo e trave os lançamentos do mês.</p>
              </div>
              <Button variant="light" onClick={() => setConfirming(true)}>
                <Lock size={16} aria-hidden="true" /> Fechar {month.label}
              </Button>
            </Card>
          )}

          <Card variant="dark">
            <div className="card__head">
              <div>
                <p className="card__sub">Para onde foi o dinheiro</p>
                <h2 className="card__title">Composição do faturamento</h2>
              </div>
            </div>
            <div className="split" role="img" aria-label="Distribuição do faturamento">
              {composition.map((c) => (
                <div key={c.label} className={`split__seg ${c.cls}`} style={{ flexGrow: Math.max(c.value, 1) }}>
                  <span className="split__pct">{pct(c.value, month.gross)}%</span>
                  <span className="split__bar" />
                </div>
              ))}
            </div>
            <ul className="split__legend">
              {composition.map((c) => (
                <li key={c.label}>
                  <i className={`split__dot ${c.cls}`} />
                  <span>{c.label}</span>
                  <strong>{formatBRL(c.value)}</strong>
                </li>
              ))}
            </ul>
            <p className="card__sub" style={{ marginTop: 10 }}>
              Taxas de cartão estimadas em {CARD_FEE_PCT.toString().replace('.', ',')}% do crédito e do débito. Produtos vêm do gasto mensal cadastrado em
              Meu site.
            </p>
          </Card>

          <Card>
            <div className="card__head">
              <div>
                <p className="eyebrow">Caixa</p>
                <h2 className="card__title">Saídas do mês</h2>
              </div>
              {!closedAt && fin.expensesAvailable && (
                <Button variant="soft" size="sm" onClick={() => setAddingExpense(true)}>
                  <Plus size={16} aria-hidden="true" /> Lançar
                </Button>
              )}
            </div>
            {!fin.expensesAvailable ? (
              <p className="card__sub">As saídas ficam disponíveis assim que a atualização do banco for aplicada.</p>
            ) : monthExpenses.length === 0 ? (
              <p className="card__sub">Nenhuma saída lançada em {month.label}.</p>
            ) : (
              <ul className="list">
                {monthExpenses.map((e) => (
                  <li key={e.id} className="list__item">
                    <span className="list__text">
                      {e.description}
                      <small className="list__small">{format(new Date(`${e.date}T12:00:00`), 'dd/MM')}</small>
                    </span>
                    <strong className="list__value">{formatBRL(e.amount)}</strong>
                    {!closedAt && (
                      <button type="button" className="chevbtn" aria-label={`Apagar ${e.description}`} onClick={() => void onRemove(e)}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="fin__pair">
            <Card>
              <div className="card__head">
                <div>
                  <p className="eyebrow">Equipe</p>
                  <h2 className="card__title">Comissões</h2>
                </div>
              </div>
              {month.commissions.length === 0 ? (
                <p className="card__sub">Sem comissões neste mês. Defina o percentual de cada profissional para calcular.</p>
              ) : (
                <ul className="list">
                  {month.commissions.map((c) => {
                    const name = professionals.find((p) => p.id === c.professionalId)?.name ?? 'Profissional'
                    return (
                      <li key={c.professionalId} className="list__item">
                        <Avatar name={name} size="sm" />
                        <span className="list__text">
                          {name}
                          <small className="list__small">{c.qty} atendimentos</small>
                        </span>
                        <strong className="list__value">{formatBRL(c.total)}</strong>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <div className="card__head">
                <div>
                  <p className="eyebrow">Recebimentos</p>
                  <h2 className="card__title">Formas de pagamento</h2>
                </div>
              </div>
              {month.payments.length === 0 ? (
                <p className="card__sub">Os recebimentos aparecem quando você conclui atendimentos na agenda.</p>
              ) : (
                <div className="paybars">
                  {month.payments.map((p) => (
                    <div key={p.method} className="paybars__col">
                      <span className="paybars__value">{formatBRL(p.total).replace(',00', '')}</span>
                      <div className="paybars__track">
                        <div
                          className={`paybars__bar ${p.total === maxPayment ? 'is-top' : ''}`}
                          style={{ height: `${Math.max((p.total / maxPayment) * 100, 4)}%` }}
                        />
                      </div>
                      <span className="paybars__label">{p.method}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {addingExpense && <ExpenseDialog month={month} onSave={fin.addExpense} onClose={() => setAddingExpense(false)} />}
      {confirming && <CloseDialog month={month} onCancel={() => setConfirming(false)} onConfirm={() => void onClose()} />}
    </div>
  )
}

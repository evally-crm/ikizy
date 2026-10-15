import { format } from 'date-fns'
import type { ReceiptModel, ReceiptStat } from '../../domain/finance'
import { formatBRL } from '../../lib/format'
import './Invoice.css'

function statValue(stat: ReceiptStat) {
  if (stat.kind === 'money') return formatBRL(stat.value)
  if (stat.kind === 'percent') return `${stat.value}%`
  return String(stat.value)
}

/** a nota como documento limpo (cabeçalho, itens e totais), compacta para caber ao lado dos números */
export function Invoice({ model }: { model: ReceiptModel }) {
  const hasQty = model.lines.some((l) => l.qty !== undefined)
  const status = model.closedAt ? `Fechado em ${format(model.closedAt, 'dd/MM/yyyy')}` : model.preview ? `Prévia · ${model.previewLabel}` : 'Encerrado'
  const totals = model.sums.filter((s) => !s.total)
  const total = model.sums.find((s) => s.total)

  return (
    <article className="invoice" aria-label={`${model.title}: ${model.period}`}>
      <header className="invoice__top">
        <p className="invoice__logo">
          IKIZY<span>.</span>
        </p>
        <span className={`invoice__status${model.closed ? ' is-closed' : ''}`}>{model.closed ? 'Fechado' : 'Prévia'}</span>
      </header>

      <dl className="invoice__meta">
        <div>
          <dt>{model.title}</dt>
          <dd>Nº {model.number}</dd>
        </div>
        <div>
          <dt>Período</dt>
          <dd className="invoice__period">{model.period.toLowerCase()}</dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>{status}</dd>
        </div>
      </dl>

      <div className="invoice__party">
        <span>Emitido por</span>
        <strong>{model.salonName}</strong>
      </div>

      {model.lines.length === 0 ? (
        <p className="invoice__empty">Nenhum atendimento concluído neste período.</p>
      ) : (
        <table className="invoice__table">
          <thead>
            <tr>
              <th>{model.itemsHeading}</th>
              {hasQty && <th>Qtd</th>}
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {model.lines.map((l, i) => (
              <tr key={`${l.label}-${i}`}>
                <td>{l.label}</td>
                {hasQty && <td>{l.qty ?? ''}</td>}
                <td>{formatBRL(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="invoice__bottom">
        <dl className="invoice__stats">
          {model.stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{statValue(s)}</dd>
            </div>
          ))}
        </dl>
        <dl className="invoice__sums">
          {totals.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{formatBRL(s.value)}</dd>
            </div>
          ))}
          {total && (
            <div className="invoice__total">
              <dt>{total.label}</dt>
              <dd>{formatBRL(total.value)}</dd>
            </div>
          )}
        </dl>
      </div>

      <footer className="invoice__foot">
        <span>Observações</span>
        <p>
          {model.footer}.{model.note ? ` ${model.note}` : ''}
        </p>
      </footer>
    </article>
  )
}

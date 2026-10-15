import type { ReceiptModel, ReceiptStat } from '../../domain/finance'
import { formatBRL } from '../../lib/format'
import { DailyLine } from '../charts/DailyLine'
import './Receipt.css'

const short = (v: number) => formatBRL(v).replace(',00', '')

function statValue(stat: ReceiptStat) {
  if (stat.kind === 'money') return formatBRL(stat.value)
  if (stat.kind === 'percent') return `${stat.value}%`
  return String(stat.value)
}

/** o recibo como papel de cupom: desenha o documento que o domínio montou (dia ou mês) */
export function Receipt({ model }: { model: ReceiptModel }) {
  return (
    <article className="receipt" aria-label={`${model.title}: ${model.period}`}>
      <div className="receipt__paper">
        {model.closed && (
          <span className="receipt__stamp" aria-hidden="true">
            Fechado
          </span>
        )}
        <header className="receipt__head">
          <p className="receipt__logo">
            IKIZY<span>.</span>
          </p>
          <p className="receipt__title">{model.title}</p>
          <p>Nº {model.number}</p>
          <p>{model.period}</p>
          <p>{model.salonName}</p>
          {model.preview && <p className="receipt__preview">Prévia · {model.previewLabel}</p>}
        </header>

        <hr />
        {model.lines.length === 0 ? (
          <p className="receipt__empty">Nenhum atendimento concluído neste período.</p>
        ) : (
          <table className="receipt__table">
            <thead>
              <tr>
                <th>{model.itemsHeading}</th>
                {model.lines.some((l) => l.qty !== undefined) && <th>Qtd</th>}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {model.lines.map((l, i) => (
                <tr key={`${l.label}-${i}`}>
                  <td>
                    {model.kind === 'month' ? `${i + 1}. ` : ''}
                    {l.label}
                  </td>
                  {l.qty !== undefined && <td>{l.qty}</td>}
                  <td>{formatBRL(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <hr />
        <dl className="receipt__sums">
          {model.sums.map((s) => (
            <div key={s.label} className={s.total ? 'receipt__total' : undefined}>
              <dt>{s.label}</dt>
              <dd>{formatBRL(s.value)}</dd>
            </div>
          ))}
        </dl>

        <hr />
        <dl className="receipt__stats">
          {model.stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{statValue(s)}</dd>
            </div>
          ))}
        </dl>

        {model.chart && (
          <>
            <hr />
            <div className="receipt__chart-head">
              <span>{model.chart.title}</span>
              <span>
                {short(model.chart.range[0])} – {short(model.chart.range[1])}
              </span>
            </div>
            <DailyLine values={model.chart.values} />
            {model.chart.best && (
              <p className="receipt__best">
                Melhor dia: {model.chart.best.label} · {formatBRL(model.chart.best.value)}
              </p>
            )}
          </>
        )}

        <hr />
        <footer className="receipt__foot">
          <p>{model.footer}</p>
          {model.note && <p>{model.note}</p>}
          <p>Obrigada por cuidar de quem cuida ♥</p>
          <div className="receipt__barcode" aria-hidden="true" />
        </footer>
      </div>
    </article>
  )
}

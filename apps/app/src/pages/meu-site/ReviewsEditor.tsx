import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useReviews } from '../../data/useReviews'
import { summarizeReviews } from '../../domain/site'
import { Switch } from '../../components/controls'
import './MeuSite.css'

const LABEL = ['Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente']

/** parte "Avaliações": o que as clientes escreveram depois do atendimento; esconder tira do site na hora */
export function ReviewsEditor() {
  const { items, loading, error, setHidden } = useReviews()
  const [problem, setProblem] = useState<string | null>(null)
  const sum = summarizeReviews(items)

  const toggle = async (id: string, show: boolean) => {
    setProblem(await setHidden(id, !show))
  }

  return (
    <div className="catalog">
      <p className="catalog__intro">
        A cliente avalia pelo link do pedido, depois que o atendimento é concluído. As avaliações com texto aparecem no site; esconda
        a que não quiser mostrar. A mudança vale na hora, sem publicar.
      </p>

      {(error ?? problem) && (
        <p className="field__hint" role="alert">
          {error ?? problem}
        </p>
      )}

      {!loading && items.length > 0 && (
        <p className="reviews__sum">
          <strong>{sum.average !== null ? sum.average.toString().replace('.', ',') : '-'}</strong> de 5 · {sum.count}{' '}
          {sum.count === 1 ? 'avaliação no site' : 'avaliações no site'}
          {sum.hidden > 0 && ` · ${sum.hidden} ${sum.hidden === 1 ? 'escondida' : 'escondidas'}`}
        </p>
      )}

      {loading && <p className="catalog__empty">Carregando…</p>}
      {!loading && !error && items.length === 0 && (
        <p className="catalog__empty">Nenhuma avaliação ainda. Elas chegam depois que você conclui um atendimento e a cliente conta como foi.</p>
      )}

      <ul className="rows">
        {items.map((r) => (
          <li key={r.id} className={`row ${r.hidden ? 'is-hidden' : ''}`.trim()}>
            <div className="row__top">
              <span className="dots" role="img" aria-label={`Nota ${r.rating} de 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <i key={i} className={i <= r.rating ? 'on' : ''} />
                ))}
              </span>
              <span className="reviews__who">
                {LABEL[r.rating - 1]}
                <small>
                  {[r.firstName, r.service, format(parseISO(r.createdAt), "d 'de' MMM", { locale: ptBR })].filter(Boolean).join(' · ')}
                </small>
              </span>
              <Switch checked={!r.hidden} onChange={(v) => void toggle(r.id, v)} label="No site" />
            </div>
            {r.comment ? <p className="reviews__text">{r.comment}</p> : <p className="reviews__text reviews__text--none">Só a nota, sem texto: não aparece no site.</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

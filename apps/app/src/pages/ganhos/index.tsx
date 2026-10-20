import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useEarnings } from '../../data/useEarnings'
import { Button, Em, PageHeader } from '../../components/ui'
import { PageLoader } from '../../components/PageLoader'
import { formatBRL } from '../../lib/format'
import './Ganhos.css'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** /dashboard/ganhos: a comissão do mês da profissional, só dela, no visual do Início */
export default function Ganhos() {
  const { displayName } = useAuth()
  const e = useEarnings()
  const { earnings } = e
  const monthName = capitalize(format(e.month, "MMMM 'de' yyyy", { locale: ptBR }))

  return (
    <div className="page earn">
      <PageHeader
        title={
          <>
            Meus <Em>ganhos</Em>
          </>
        }
        crumb={`${displayName.split(' ')[0]}, sua comissão de ${monthName.toLowerCase()}`}
        actions={
          <div className="earn__months">
            <Button variant="soft" size="sm" icon aria-label="Mês anterior" onClick={e.prev}>
              <ChevronLeft size={18} />
            </Button>
            <span className="earn__month">{monthName}</span>
            <Button variant="soft" size="sm" icon aria-label="Próximo mês" onClick={e.next} disabled={e.isCurrent}>
              <ChevronRight size={18} />
            </Button>
          </div>
        }
      />

      {e.error && (
        <p className="dialog__error" role="alert">
          {e.error}
        </p>
      )}

      {e.unlinked ? (
        <section className="earn__card">
          <h2 className="earn__title">Seu acesso ainda não está ligado à agenda</h2>
          <p className="earn__caption">Peça para a dona do negócio ligar você a quem atende, em Meu negócio → Equipe.</p>
        </section>
      ) : e.loading ? (
        <PageLoader label="Carregando seus ganhos…" />
      ) : (
        <>
          <div className="earn__bento">
            <section className="earn__card earn__hero">
              <span className="earn__kicker">{e.isCurrent ? 'Este mês' : monthName}</span>
              <span className="earn__value">{formatBRL(earnings.commission)}</span>
              <span className="earn__caption">
                {earnings.pct > 0 ? `sua comissão de ${earnings.pct}% sobre os atendimentos concluídos` : 'a comissão ainda não foi definida pela dona do negócio'}
              </span>
              <dl className="earn__row">
                <div>
                  <dt>concluídos</dt>
                  <dd>{earnings.done.length}</dd>
                </div>
                <div>
                  <dt>atendido</dt>
                  <dd>{formatBRL(earnings.gross)}</dd>
                </div>
                <div>
                  <dt>a fazer no mês</dt>
                  <dd>{earnings.upcoming}</dd>
                </div>
              </dl>
            </section>

            <section className="earn__pct">
              <span className="earn__label">Seu percentual</span>
              <span className="earn__big">{earnings.pct > 0 ? `${earnings.pct}%` : '–'}</span>
              <small>Definido pela dona do negócio. Conta só o que foi concluído.</small>
            </section>
          </div>

          <section className="earn__card">
            <h2 className="earn__title">Atendimentos concluídos</h2>
            {earnings.done.length === 0 ? (
              <p className="earn__caption">Nenhum atendimento concluído neste mês ainda.</p>
            ) : (
              <ul className="earn__list">
                {earnings.done.map((a) => (
                  <li key={a.id} className="earn__item">
                    <span className="earn__date">{format(a.startsAt, 'dd/MM')}</span>
                    <span className="earn__who">
                      <strong>{a.clientName}</strong>
                      <small>
                        {a.serviceName} · {formatBRL(a.price)}
                      </small>
                    </span>
                    <span className="earn__gain">{formatBRL(a.commission)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

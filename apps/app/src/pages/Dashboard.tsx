import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, Clock, Send, Wallet } from 'lucide-react'
import { appointments, professionals, weekRevenue } from '../data/mock'
import { MONTHLY_GOAL, getMonths } from '../data/finance'
import { clientTags, daysSince, getClients, TAG_LABEL } from '../data/clients'
import { formatBRL, formatTime } from '../lib/format'
import { dash } from '../lib/routes'
import { Avatar, Card, Em, Money, StatusBadge } from '../components/ui'

const proName = (id: string) => professionals.find((p) => p.id === id)?.name ?? ''
const short = (v: number) => formatBRL(v).replace(',00', '')

/** traços verticais tipo "código de barras" que mostram uma proporção */
function Ticks({ ratio, label }: { ratio: number; label: string }) {
  const total = 28
  const on = Math.round(Math.min(Math.max(ratio, 0), 1) * total)
  return (
    <div className="ticks" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < on ? 'is-on' : ''} />
      ))}
    </div>
  )
}

export default function Dashboard() {
  const now = useMemo(() => new Date(), [])
  const today = [...appointments].sort((a, b) => a.start - b.start)
  const done = today.filter((a) => a.status === 'concluido')
  const upcoming = today.filter((a) => a.status !== 'concluido')
  const [next, ...rest] = upcoming
  const expected = today.reduce((s, a) => s + a.price, 0)
  const realized = done.reduce((s, a) => s + a.price, 0)

  // índice do dia atual com a semana começando na segunda
  const todayIdx = (getDay(now) + 6) % 7
  const [selectedDay, setSelectedDay] = useState(todayIdx)
  const best = Math.max(...weekRevenue.map((d) => d.value), 1)
  const weekTotal = weekRevenue.reduce((s, d) => s + d.value, 0)
  const growth = 12

  const month = getMonths(now)[2]
  const daysLeft = month.daysInMonth - month.elapsedDays
  const goalPct = Math.round((month.gross / MONTHLY_GOAL) * 100)
  const monthName = month.label[0].toUpperCase() + month.label.slice(1)

  const clients = useMemo(() => getClients(now), [now])
  const toContact = clients
    .map((c) => ({ c, tags: clientTags(c, now).filter((t) => t === 'aniversario' || t === 'sumida') }))
    .filter((x) => x.tags.length)
    .sort((a, b) => (a.tags[0] === 'aniversario' ? -1 : 0) - (b.tags[0] === 'aniversario' ? -1 : 0))

  return (
    <div className="page page--fit">
      <header className="bar">
        <h1 className="bar__title">
          Olá, Maria. Resumo de <Em>hoje</Em>
        </h1>
        <div className="bar__side">
        <dl className="minis">
          <div className="mini">
            <dt>Previsto hoje</dt>
            <dd>{short(expected)}</dd>
          </div>
          <div className="mini">
            <dt>No caixa</dt>
            <dd>{short(realized)}</dd>
          </div>
          <div className="mini">
            <dt>Concluídos</dt>
            <dd>
              {done.length}/{today.length}
            </dd>
          </div>
        </dl>
        <span className="datechip">
          <CalendarDays size={15} aria-hidden="true" />
          {format(now, "EEE, dd 'de' MMM", { locale: ptBR }).replace('.', '')}
        </span>
        </div>
      </header>

      <div className="dash">
        {/* faturamento da semana */}
        <Card className="dash__tracker tracker">
          <div className="tracker__head">
            <div className="tracker__title">
              <span className="iconcircle" aria-hidden="true">
                <Wallet size={18} />
              </span>
              <h2>Faturamento</h2>
            </div>
            <span className="pill">Esta semana</span>
          </div>
          <p className="tracker__desc">Quanto entrou em cada dia. Toque em um dia para ver o valor.</p>

          <div className="tracker__body">
            <div className="tracker__summary">
              <p className="tracker__growth">
                +{growth}
                <small>%</small>
              </p>
              <p className="card__sub">acima da semana passada</p>
              <Money value={weekTotal} size="md" />
            </div>

            <div className="lolli" role="group" aria-label="Faturamento por dia">
              {weekRevenue.map((d, i) => {
                const h = (d.value / best) * 100
                const active = i === selectedDay
                return (
                  <button
                    key={d.day}
                    type="button"
                    className={`lolli__col ${active ? 'is-active' : ''}`}
                    aria-pressed={active}
                    aria-label={`${d.day}: ${formatBRL(d.value)}`}
                    onClick={() => setSelectedDay(i)}
                  >
                    <span className="lolli__track">
                      <span className="lolli__stem" style={{ height: `${Math.max(h, 2)}%` }}>
                        <span className="lolli__dot" />
                        {active && <span className="lolli__tip">{short(d.value)}</span>}
                      </span>
                    </span>
                    <span className={`lolli__day ${i === todayIdx ? 'is-today' : ''}`}>{d.day.slice(0, 1)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </Card>

        {/* próximos atendimentos */}
        <Card className="dash__next upnext">
          <div className="card__head">
            <h2 className="card__title">Próximos atendimentos</h2>
            <Link to={dash('/agenda')} className="textlink">
              Ver agenda
            </Link>
          </div>

          {next ? (
            <div className="upnext__scroll">
              <div className="upnext__hero">
                <div className="upnext__row">
                  <Avatar name={next.client} />
                  <div className="upnext__who">
                    <p className="upnext__name">{next.client}</p>
                    <p className="card__sub">{next.service}</p>
                  </div>
                  <StatusBadge status={next.status} />
                </div>
                <div className="upnext__chips">
                  <span className="pill pill--dark">
                    <Clock size={12} aria-hidden="true" /> {formatTime(next.start)}
                  </span>
                  <span className="pill">{proName(next.professionalId)}</span>
                  <span className="pill">{short(next.price)}</span>
                </div>
              </div>

              <ul className="upnext__list">
                {rest.map((a) => (
                  <li key={a.id} className="upnext__item">
                    <span className="upnext__time">{formatTime(a.start)}</span>
                    <div className="upnext__who">
                      <p className="upnext__name">{a.client}</p>
                      <p className="card__sub">
                        {a.service} · {proName(a.professionalId)}
                      </p>
                    </div>
                    <Link to={dash('/agenda')} className="chevbtn" aria-label={`Ver ${a.client} na agenda`}>
                      <ChevronRight size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="card__sub">Nenhum atendimento restante hoje.</p>
          )}
        </Card>

        {/* relacionamento */}
        <Card className="dash__people">
          <div className="card__head">
            <h2 className="card__title">Vale um contato</h2>
            <Link to={dash('/clientes')} className="textlink">
              Ver clientes
            </Link>
          </div>
          <ul className="people">
            {toContact.map(({ c, tags }) => (
              <li key={c.id} className="people__item">
                <Avatar name={c.name} size="sm" soft />
                <div className="people__body">
                  <p className="upnext__name">
                    {c.name} <span className={`tag tag--${tags[0]}`}>{TAG_LABEL[tags[0]]}</span>
                  </p>
                  <p className="card__sub">
                    {tags[0] === 'aniversario'
                      ? `Aniversário em ${c.birthday.split('-').reverse().join('/')}`
                      : `Sem vir há ${daysSince(c.lastVisit, now)} dias`}
                  </p>
                </div>
                <button type="button" className="chevbtn" aria-label={`Mandar mensagem para ${c.name}`}>
                  <Send size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* fechamento do mês */}
        <Card className="dash__close closecard">
          <div className="closecard__orb" aria-hidden="true" />
          <div className="closecard__body">
            <h2 className="closecard__title">
              {daysLeft === 0 ? (
                <>
                  Hoje é dia de <Em>fechar</Em> {month.label}
                </>
              ) : (
                <>
                  {monthName} fecha em <Em>{daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}</Em>
                </>
              )}
            </h2>
            <p className="card__sub">
              {short(month.gross)} acumulados · {goalPct}% da meta de {short(MONTHLY_GOAL)}
            </p>
          </div>
          <Link to={dash('/financeiro')} className="closecard__cta">
            {daysLeft <= 3 ? 'Fechar o mês' : 'Ver prévia do fechamento'}
            <span className="closecard__arrow">
              <ArrowRight size={16} aria-hidden="true" />
            </span>
          </Link>
        </Card>

        {/* mês em números */}
        <Card className="dash__month">
          <div className="card__head">
            <h2 className="card__title">{monthName} em números</h2>
            <Link to={dash('/financeiro')} className="chevbtn" aria-label="Abrir financeiro">
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="monthnums">
            <div className="monthnums__item">
              <p className="card__sub">Atendimentos</p>
              <p className="monthnums__value">{month.appointments}</p>
              <Ticks ratio={month.elapsedDays / month.daysInMonth} label="Progresso do mês" />
            </div>
            <div className="monthnums__item">
              <p className="card__sub">Novas clientes</p>
              <p className="monthnums__value">{month.newClients}</p>
              <Ticks ratio={month.newClients / 16} label="Novas clientes em relação à média" />
            </div>
            <div className="monthnums__item">
              <p className="card__sub">Meta</p>
              <p className="monthnums__value">
                {goalPct}
                <small>%</small>
              </p>
              <Ticks ratio={goalPct / 100} label={`${goalPct}% da meta`} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

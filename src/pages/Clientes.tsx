import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Camera,
  Check,
  FileSignature,
  Gift,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  MISSING_AFTER,
  STAMPS_PER_REWARD,
  TAG_LABEL,
  clientTags,
  daysSince,
  getClients,
  type Client,
  type ClientTag,
} from '../data/clients'
import { professionals } from '../data/mock'
import { formatBRL } from '../lib/format'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Avatar, Button, Card, Em, Money } from '../components/ui'

type Filter = 'todas' | ClientTag

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'vip', label: 'VIP' },
  { id: 'nova', label: 'Novas' },
  { id: 'sumida', label: 'Sumidas' },
  { id: 'aniversario', label: 'Aniversário' },
]

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const proName = (id: string) => professionals.find((p) => p.id === id)?.name ?? ''

function lastVisitLabel(days: number) {
  if (days === 0) return 'Veio hoje'
  if (days === 1) return 'Veio ontem'
  return `Última visita há ${days} dias`
}

function Tags({ tags }: { tags: ClientTag[] }) {
  if (!tags.length) return null
  return (
    <span className="tags">
      {tags.map((t) => (
        <span key={t} className={`tag tag--${t}`}>
          {TAG_LABEL[t]}
        </span>
      ))}
    </span>
  )
}

function ClientList({
  clients,
  selectedId,
  today,
}: {
  clients: Client[]
  selectedId?: string
  today: Date
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('todas')

  const visible = useMemo(() => {
    const q = normalize(query.trim())
    return clients
      .filter((c) => filter === 'todas' || clientTags(c, today).includes(filter))
      .filter((c) => !q || normalize(c.name).includes(q) || c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§'))
      .sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime())
  }, [clients, query, filter, today])

  return (
    <Card className="crm__list">
      <label className="search">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Buscar cliente</span>
        <input
          type="search"
          placeholder="Buscar por nome ou telefone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </label>

      <div className="chips chips--scroll" role="group" aria-label="Filtrar clientes">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="chip"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="crm__count">
        {visible.length} {visible.length === 1 ? 'cliente' : 'clientes'}
      </p>

      {visible.length === 0 ? (
        <p className="crm__empty">Nenhuma cliente encontrada.</p>
      ) : (
        <ul className="clist">
          {visible.map((c) => {
            const days = daysSince(c.lastVisit, today)
            return (
              <li key={c.id}>
                <Link
                  to={`/clientes/${c.id}`}
                  className={`clist__item ${c.id === selectedId ? 'is-active' : ''}`}
                  aria-current={c.id === selectedId ? 'page' : undefined}
                >
                  <Avatar name={c.name} soft={c.id !== selectedId} />
                  <span className="clist__body">
                    <span className="clist__name">{c.name}</span>
                    <span className="clist__meta">
                      {lastVisitLabel(days)} · {c.visits} {c.visits === 1 ? 'visita' : 'visitas'}
                    </span>
                    <Tags tags={clientTags(c, today)} />
                  </span>
                  <span className="clist__spent">{formatBRL(c.totalSpent).replace(',00', '')}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function ClientDetail({ client, today, showBack }: { client: Client; today: Date; showBack: boolean }) {
  const tags = clientTags(client, today)
  const days = daysSince(client.lastVisit, today)
  const nextExpected = addDays(client.lastVisit, client.interval)
  const overdue = daysSince(nextExpected, today)
  const ticket = Math.round(client.totalSpent / client.visits)
  const stamps = client.visits % STAMPS_PER_REWARD
  const rewards = Math.floor(client.visits / STAMPS_PER_REWARD)
  const firstName = client.name.split(' ')[0]

  return (
    <div className="crm__detail">
      {showBack && (
        <Link to="/clientes" className="backlink">
          <ArrowLeft size={18} aria-hidden="true" /> Clientes
        </Link>
      )}

      {/* perfil — card escuro */}
      <Card variant="dark" className="profile">
        <div className="profile__top">
          <div className="profile__who">
            <span className="profile__avatar" aria-hidden="true">
              {client.name
                .split(' ')
                .slice(0, 2)
                .map((p) => p[0])
                .join('')}
            </span>
            <div>
              <h2 className="profile__name">{client.name}</h2>
              <p className="card__sub">
                Cliente desde {format(client.since, "MMM 'de' yyyy", { locale: ptBR })} · com {proName(client.professionalId)}
              </p>
              <Tags tags={tags} />
            </div>
          </div>
          <div className="profile__actions">
            <a className="roundbtn" href={`tel:${client.phone.replace(/\D/g, '')}`} aria-label={`Ligar para ${firstName}`}>
              <Phone size={18} />
            </a>
            <button type="button" className="roundbtn" aria-label={`Mensagem no WhatsApp para ${firstName}`}>
              <MessageCircle size={18} />
            </button>
            <Button variant="accent" icon aria-label={`Agendar ${firstName}`}>
              <CalendarPlus size={18} />
            </Button>
          </div>
        </div>

        <div className="profile__stats">
          <div>
            <p className="card__sub">Total gasto</p>
            <Money value={client.totalSpent} size="lg" />
          </div>
          <div>
            <p className="card__sub">Visitas</p>
            <p className="profile__num">{client.visits}</p>
          </div>
          <div>
            <p className="card__sub">Ticket médio</p>
            <p className="profile__num">{formatBRL(ticket).replace(',00', '')}</p>
          </div>
          <div>
            <p className="card__sub">Volta a cada</p>
            <p className="profile__num">
              ~{client.interval}
              <small> dias</small>
            </p>
          </div>
        </div>

        <div className={`profile__return ${overdue > 0 ? 'is-late' : ''}`}>
          {overdue > 0 ? (
            <>
              <AlertTriangle size={18} aria-hidden="true" />
              <p>
                {days > MISSING_AFTER ? `${firstName} sumiu há ${days} dias.` : `Retorno atrasado ${overdue} ${overdue === 1 ? 'dia' : 'dias'}.`}{' '}
                <strong>Mande um convite com cupom de retorno.</strong>
              </p>
              <Button variant="light" size="sm">
                Enviar convite
              </Button>
            </>
          ) : (
            <>
              <Sparkles size={18} aria-hidden="true" />
              <p>
                Próxima visita prevista para <strong>{format(nextExpected, "dd 'de' MMMM", { locale: ptBR })}</strong>.{' '}
                {lastVisitLabel(days)}.
              </p>
            </>
          )}
        </div>
      </Card>

      <div className="detail-grid">
        {/* fidelidade */}
        <Card className="loyalty">
          <div className="card__head">
            <div>
              <p className="eyebrow">Cartão fidelidade</p>
              <h3 className="card__title">
                {stamps} de {STAMPS_PER_REWARD} selos
              </h3>
            </div>
            <Gift size={20} aria-hidden="true" className="loyalty__icon" />
          </div>
          <div className="stamps" role="img" aria-label={`${stamps} de ${STAMPS_PER_REWARD} selos`}>
            {Array.from({ length: STAMPS_PER_REWARD }, (_, i) => (
              <span key={i} className={`stamps__item ${i < stamps ? 'is-on' : ''}`}>
                {i < stamps && <Check size={14} aria-hidden="true" />}
              </span>
            ))}
          </div>
          <p className="card__sub">
            Faltam {STAMPS_PER_REWARD - stamps} visitas para ganhar um serviço.
            {rewards > 0 && ` Já resgatou ${rewards} ${rewards === 1 ? 'prêmio' : 'prêmios'}.`}
          </p>
        </Card>

        {/* cuidados */}
        <Card>
          <div className="card__head">
            <div>
              <p className="eyebrow">Cuidados</p>
              <h3 className="card__title">Preferências</h3>
            </div>
          </div>
          {client.allergies.length > 0 && (
            <div className="allergy">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                <strong>Atenção:</strong> {client.allergies.join(', ')}
              </span>
            </div>
          )}
          <ul className="prefs">
            {client.preferences.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Card>

        {/* histórico */}
        <Card className="detail-grid__wide">
          <div className="card__head">
            <div>
              <p className="eyebrow">Histórico</p>
              <h3 className="card__title">Últimos atendimentos</h3>
            </div>
            <span className="card__sub">{client.visits} no total</span>
          </div>
          <ol className="history">
            {client.history.map((v, i) => (
              <li key={i} className="history__item">
                <span className="history__date">
                  <strong>{format(v.date, 'dd')}</strong>
                  {format(v.date, 'MMM', { locale: ptBR }).replace('.', '')}
                </span>
                <span className="history__body">
                  <span className="history__service">{v.service}</span>
                  <span className="card__sub">com {proName(v.professionalId)}</span>
                </span>
                <span className="history__price">{formatBRL(v.price)}</span>
              </li>
            ))}
          </ol>
        </Card>

        {/* galeria */}
        <Card>
          <div className="card__head">
            <div>
              <p className="eyebrow">Galeria</p>
              <h3 className="card__title">Antes e depois</h3>
            </div>
          </div>
          <div className="gallery">
            {client.history.slice(0, 2).map((v, i) => (
              <figure key={i} className={`gallery__item gallery__item--${i}`}>
                <figcaption>
                  {i === 0 ? 'Depois' : 'Antes'} · {format(v.date, 'dd/MM')}
                </figcaption>
              </figure>
            ))}
            <button type="button" className="gallery__add">
              <Camera size={20} aria-hidden="true" />
              Adicionar
            </button>
          </div>
        </Card>

        {/* anamnese */}
        <Card className={`anamnesis ${client.anamnesisSignedAt ? 'is-signed' : ''}`}>
          <div className="card__head">
            <div>
              <p className="eyebrow">Ficha de anamnese</p>
              <h3 className="card__title">{client.anamnesisSignedAt ? 'Assinada' : 'Pendente'}</h3>
            </div>
            <FileSignature size={20} aria-hidden="true" />
          </div>
          {client.anamnesisSignedAt ? (
            <p className="card__sub">
              Termo de consentimento assinado digitalmente em {format(client.anamnesisSignedAt, 'dd/MM/yyyy')}.
            </p>
          ) : (
            <>
              <p className="card__sub">
                {firstName} ainda não preencheu a ficha. Envie o link para ela assinar pelo celular antes do próximo atendimento.
              </p>
              <Button size="sm" className="anamnesis__btn">
                Enviar ficha no WhatsApp
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

export default function Clientes() {
  const today = useMemo(() => new Date(), [])
  const clients = useMemo(() => getClients(today), [today])
  const { id } = useParams()
  const navigate = useNavigate()
  const isWide = useMediaQuery('(min-width: 1100px)')

  const selected = clients.find((c) => c.id === id) ?? (isWide ? clients[0] : undefined)
  const missing = clients.filter((c) => clientTags(c, today).includes('sumida')).length
  const newOnes = clients.filter((c) => clientTags(c, today).includes('nova')).length
  const returning = Math.round((clients.filter((c) => c.visits > 1).length / clients.length) * 100)

  // no mobile, a ficha ocupa a tela inteira
  if (!isWide && selected) {
    return (
      <div className="page">
        <ClientDetail client={selected} today={today} showBack />
      </div>
    )
  }

  return (
    <div className="page page--fit">
      <header className="bar">
        <h1 className="bar__title">
          Sua <Em>carteira</Em>
        </h1>
        <div className="bar__side">
        <dl className="minis">
          <div className="mini">
            <dt>Ativas</dt>
            <dd>{clients.length}</dd>
          </div>
          <div className="mini">
            <dt>Novas no mês</dt>
            <dd>{newOnes}</dd>
          </div>
          <div className="mini">
            <dt>Retorno</dt>
            <dd>{returning}%</dd>
          </div>
          <div className="mini mini--alert">
            <dt>Sumidas</dt>
            <dd>{missing}</dd>
          </div>
        </dl>
        <Button size="sm" onClick={() => navigate('/clientes')}>
          <Plus size={16} aria-hidden="true" /> Nova cliente
        </Button>
        </div>
      </header>

      <div className="crm">
        <ClientList clients={clients} selectedId={selected?.id} today={today} />
        {selected && <ClientDetail client={selected} today={today} showBack={false} />}
      </div>
    </div>
  )
}

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
  Pencil,
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
  type Client,
  type ClientTag,
} from '../data/clients'
import { useClientBook, type ProfessionalOption } from '../data/useClientBook'
import { ClientDialog } from '../components/ClientDialog'
import { formatBRL } from '../lib/format'
import { dash } from '../lib/routes'
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

const whatsappUrl = (phone: string, text?: string) => {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const number = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

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
                  to={dash(`/clientes/${c.id}`)}
                  className={`clist__item ${c.id === selectedId ? 'is-active' : ''}`}
                  aria-current={c.id === selectedId ? 'page' : undefined}
                >
                  <Avatar name={c.name} soft={c.id !== selectedId} />
                  <span className="clist__body">
                    <span className="clist__name">{c.name}</span>
                    <span className="clist__meta">
                      {c.visits === 0 ? 'Ainda sem visitas' : `${lastVisitLabel(days)} · ${c.visits} ${c.visits === 1 ? 'visita' : 'visitas'}`}
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

function ClientDetail({
  client,
  today,
  showBack,
  live,
  professionals,
  onEdit,
  onAnamnesis,
}: {
  client: Client
  today: Date
  showBack: boolean
  live: boolean
  professionals: ProfessionalOption[]
  onEdit: () => void
  onAnamnesis: () => Promise<string | null>
}) {
  const navigate = useNavigate()
  const [anamnesisError, setAnamnesisError] = useState<string | null>(null)
  const proName = (id: string) => professionals.find((p) => p.id === id)?.name ?? ''
  const hasVisits = client.visits > 0
  const tags = clientTags(client, today)
  const days = daysSince(client.lastVisit, today)
  const nextExpected = addDays(client.lastVisit, client.interval)
  const overdue = hasVisits ? daysSince(nextExpected, today) : 0
  const ticket = hasVisits ? Math.round(client.totalSpent / client.visits) : 0
  const stamps = client.visits % STAMPS_PER_REWARD
  const rewards = Math.floor(client.visits / STAMPS_PER_REWARD)
  const firstName = client.name.split(' ')[0]

  return (
    <div className="crm__detail">
      {showBack && (
        <Link to={dash('/clientes')} className="backlink">
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
                Cliente desde {format(client.since, "MMM 'de' yyyy", { locale: ptBR })}
                {proName(client.professionalId) && ` · com ${proName(client.professionalId)}`}
              </p>
              <Tags tags={tags} />
            </div>
          </div>
          <div className="profile__actions">
            <a className="roundbtn" href={`tel:${client.phone.replace(/\D/g, '')}`} aria-label={`Ligar para ${firstName}`}>
              <Phone size={18} />
            </a>
            {whatsappUrl(client.phone) && (
              <a
                className="roundbtn"
                href={whatsappUrl(client.phone) ?? undefined}
                target="_blank"
                rel="noreferrer"
                aria-label={`Mensagem no WhatsApp para ${firstName}`}
              >
                <MessageCircle size={18} />
              </a>
            )}
            <button type="button" className="roundbtn" aria-label={`Editar ${firstName}`} onClick={onEdit}>
              <Pencil size={18} />
            </button>
            <Button variant="accent" icon aria-label={`Agendar ${firstName}`} onClick={() => navigate(dash('/agenda'))}>
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
              {client.visits > 1 ? (
                <>
                  ~{client.interval}
                  <small> dias</small>
                </>
              ) : (
                '—'
              )}
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
              {whatsappUrl(client.phone) && (
                <a
                  className="btn btn--light btn--sm"
                  href={whatsappUrl(client.phone, `Oi, ${firstName}! Sentimos sua falta por aqui. Vamos marcar um horário?`) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  Enviar convite
                </a>
              )}
            </>
          ) : hasVisits ? (
            <>
              <Sparkles size={18} aria-hidden="true" />
              <p>
                Próxima visita prevista para <strong>{format(nextExpected, "dd 'de' MMMM", { locale: ptBR })}</strong>.{' '}
                {lastVisitLabel(days)}.
              </p>
            </>
          ) : (
            <>
              <Sparkles size={18} aria-hidden="true" />
              <p>Ainda sem atendimentos concluídos. O histórico e o retorno aparecem depois do primeiro.</p>
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
          {client.preferences.length === 0 && client.allergies.length === 0 && (
            <p className="card__sub">
              Nada anotado ainda.{' '}
              <button type="button" className="textlink" onClick={onEdit}>
                Adicionar
              </button>
            </p>
          )}
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
          {client.history.length === 0 && <p className="card__sub">Os atendimentos concluídos aparecem aqui.</p>}
          <ol className="history">
            {client.history.map((v, i) => (
              <li key={i} className="history__item">
                <span className="history__date">
                  <strong>{format(v.date, 'dd')}</strong>
                  {format(v.date, 'MMM', { locale: ptBR }).replace('.', '')}
                </span>
                <span className="history__body">
                  <span className="history__service">{v.service}</span>
                  {proName(v.professionalId) && <span className="card__sub">com {proName(v.professionalId)}</span>}
                </span>
                <span className="history__price">{formatBRL(v.price)}</span>
              </li>
            ))}
          </ol>
        </Card>

        {/* galeria (ainda sem armazenamento de fotos: só na demonstração) */}
        {!live && (
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
        )}

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
              Termo de consentimento registrado em {format(client.anamnesisSignedAt, 'dd/MM/yyyy')}.
            </p>
          ) : (
            <>
              <p className="card__sub">
                {firstName} ainda não assinou a ficha. Colha a assinatura antes do próximo atendimento e registre aqui.
              </p>
              <Button size="sm" className="anamnesis__btn" onClick={async () => setAnamnesisError(await onAnamnesis())}>
                Marcar como assinada
              </Button>
              {anamnesisError && (
                <p className="dialog__error" role="alert">
                  {anamnesisError}
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

export default function Clientes() {
  const today = useMemo(() => new Date(), [])
  const book = useClientBook()
  const { clients, professionals, live } = book
  const { id } = useParams()
  const navigate = useNavigate()
  const isWide = useMediaQuery('(min-width: 1100px)')
  const [dialog, setDialog] = useState<'new' | 'edit' | null>(null)

  const selected = clients.find((c) => c.id === id) ?? (isWide ? clients[0] : undefined)
  const missing = clients.filter((c) => clientTags(c, today).includes('sumida')).length
  const newOnes = clients.filter((c) => clientTags(c, today).includes('nova')).length
  const returning = clients.length ? Math.round((clients.filter((c) => c.visits > 1).length / clients.length) * 100) : 0

  const dialogs = (
    <>
      {dialog === 'new' && (
        <ClientDialog
          professionals={professionals}
          onClose={() => setDialog(null)}
          onSave={async (draft) => {
            const res = await book.create(draft)
            if (res.id) navigate(dash(`/clientes/${res.id}`))
            return res.error
          }}
        />
      )}
      {dialog === 'edit' && selected && (
        <ClientDialog
          client={selected}
          professionals={professionals}
          onClose={() => setDialog(null)}
          onSave={(draft) => book.update(selected.id, draft)}
        />
      )}
    </>
  )

  const detail = (showBack: boolean) =>
    selected && (
      <ClientDetail
        client={selected}
        today={today}
        showBack={showBack}
        live={live}
        professionals={professionals}
        onEdit={() => setDialog('edit')}
        onAnamnesis={() => book.markAnamnesis(selected.id, true)}
      />
    )

  // no mobile, a ficha ocupa a tela inteira
  if (!isWide && selected) {
    return (
      <div className="page">
        {detail(true)}
        {dialogs}
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
        <Button size="sm" onClick={() => setDialog('new')}>
          <Plus size={16} aria-hidden="true" /> Nova cliente
        </Button>
        </div>
      </header>

      {book.error && (
        <p className="dialog__error" role="alert">
          {book.error}{' '}
          <button type="button" className="textlink" onClick={book.reload}>
            Tentar de novo
          </button>
        </p>
      )}

      {book.loading ? (
        <p className="crm__empty" role="status">
          Carregando clientes…
        </p>
      ) : clients.length === 0 ? (
        <Card className="agenda__empty">
          <h2 className="card__title">Cadastre sua primeira cliente</h2>
          <p className="card__sub">Elas também entram aqui sozinhas quando você faz um agendamento novo na agenda.</p>
          <Button onClick={() => setDialog('new')}>
            <Plus size={16} aria-hidden="true" /> Nova cliente
          </Button>
        </Card>
      ) : (
        <div className="crm">
          <ClientList clients={clients} selectedId={selected?.id} today={today} />
          {detail(false)}
        </div>
      )}
      {dialogs}
    </div>
  )
}

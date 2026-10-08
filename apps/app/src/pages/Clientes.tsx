import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addDays, format, isAfter } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertTriangle,
  ArrowLeft,
  AtSign,
  Briefcase,
  Cake,
  CalendarCheck,
  CalendarPlus,
  FileSignature,
  Heart,
  Pencil,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  MISSING_AFTER,
  TAG_LABEL,
  clientTags,
  daysSince,
  loyaltyState,
  type Client,
  type ClientTag,
} from '../data/clients'
import { useClientBook, useClientNotes, useClientPhotos } from '../data/useClientBook'
import { AddPhotosDialog, PhotoViewer, PhotosCard } from '../components/ClientPhotos'
import { useAuth } from '../auth/AuthProvider'
import { ClientDialog } from '../components/ClientDialog'
import {
  AnamnesisDialog,
  AnamnesisSummary,
  CareCard,
  HistoryCard,
  LoyaltyCard,
  LoyaltySettingsDialog,
  NotesCard,
  PersonalCard,
} from '../components/ClientFile'
import { answeredCount } from '../lib/anamnesis'
import { CLIENT_KINDS, type MessageKind } from '../lib/messages'
import { MessageDialog } from '../components/MessageDialog'
import { useSalonInfo } from '../hooks/useSalonInfo'
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

type Tab = 'resumo' | 'ficha' | 'historico' | 'notas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'ficha', label: 'Ficha' },
  { id: 'historico', label: 'Histórico' },
  { id: 'notas', label: 'Anotações' },
]

function ClientDetail({
  client,
  today,
  showBack,
  book,
  salonName,
  onEdit,
  onLoyaltySettings,
}: {
  client: Client
  today: Date
  showBack: boolean
  book: ReturnType<typeof useClientBook>
  salonName: string
  onEdit: () => void
  onLoyaltySettings: () => void
}) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('resumo')
  const [fileOpen, setFileOpen] = useState(false)
  const [message, setMessage] = useState<MessageKind | null>(null)
  const salonInfo = useSalonInfo()
  const [addingPhotos, setAddingPhotos] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const photos = useClientPhotos(client.id)
  const notes = useClientNotes(client.id)
  const { professionals } = book
  const proName = (id: string) => professionals.find((p) => p.id === id)?.name ?? ''
  const hasVisits = client.visits > 0
  const tags = clientTags(client, today)
  const days = daysSince(client.lastVisit, today)
  const nextExpected = addDays(client.lastVisit, client.interval)
  const overdue = hasVisits ? daysSince(nextExpected, today) : 0
  const ticket = hasVisits ? Math.round(client.totalSpent / client.visits) : 0
  const firstName = client.name.split(' ')[0]
  const reward = loyaltyState(client, book.loyaltySettings)
  // mensagem que faz mais sentido agora para esta cliente
  const suggested: MessageKind =
    book.loyaltySettings.enabled && reward.ready > 0
      ? 'premio'
      : tags.includes('aniversario')
        ? 'aniversario'
        : days > MISSING_AFTER && hasVisits
          ? 'sumida'
          : overdue > 0
            ? 'manutencao'
            : 'livre'
  const upcoming = client.appointments
    .filter((a) => (a.status === 'pendente' || a.status === 'confirmado') && isAfter(a.date, today))
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0]
  const fileDone = Boolean(client.anamnesisSignedAt) && answeredCount(client.anamnesis) > 0

  // ao trocar de cliente, volta para o resumo
  const [shownId, setShownId] = useState(client.id)
  if (shownId !== client.id) {
    setShownId(client.id)
    setTab('resumo')
    setFileOpen(false)
    setMessage(null)
    setAddingPhotos(false)
    setViewing(null)
  }

  const info = [
    client.birthday && {
      icon: <Cake size={14} aria-hidden="true" />,
      text: format(new Date(2000, Number(client.birthday.slice(0, 2)) - 1, Number(client.birthday.slice(3))), "dd 'de' MMM", { locale: ptBR }),
    },
    client.instagram && { icon: <AtSign size={14} aria-hidden="true" />, text: client.instagram, href: `https://instagram.com/${client.instagram}` },
    client.referral && { icon: <Heart size={14} aria-hidden="true" />, text: client.referral },
    client.occupation && { icon: <Briefcase size={14} aria-hidden="true" />, text: client.occupation },
  ].filter(Boolean) as { icon: ReactNode; text: string; href?: string }[]

  return (
    <div className="crm__detail">
      {showBack && (
        <Link to={dash('/clientes')} className="backlink">
          <ArrowLeft size={18} aria-hidden="true" /> Clientes
        </Link>
      )}

      {/* perfil — card escuro */}
      <Card className="profile">
        <div className="profile__top">
          <div className="profile__who">
            <span className="profile__avatar" aria-hidden="true">
              {client.name
                .split(' ')
                .filter(Boolean)
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
            <button type="button" className="roundbtn" aria-label={`Mensagem no WhatsApp para ${firstName}`} onClick={() => setMessage(suggested)}>
              <MessageCircle size={18} />
            </button>
            {client.phone.replace(/\D/g, '') && (
              <a className="roundbtn" href={`tel:${client.phone.replace(/\D/g, '')}`} aria-label={`Ligar para ${firstName}`}>
                <Phone size={18} />
              </a>
            )}
            <button type="button" className="roundbtn" aria-label={`Editar ${firstName}`} onClick={onEdit}>
              <Pencil size={18} />
            </button>
            <Button
              variant="accent"
              icon
              aria-label={`Agendar ${firstName}`}
              onClick={() => navigate(dash(`/agenda?nova=1&cliente=${encodeURIComponent(client.name)}`))}
            >
              <CalendarPlus size={18} />
            </Button>
          </div>
        </div>

        {info.length > 0 && (
          <ul className="profile__info">
            {info.map((i) => (
              <li key={i.text}>
                {i.icon}
                {i.href ? (
                  <a href={i.href} target="_blank" rel="noreferrer">
                    {i.text}
                  </a>
                ) : (
                  i.text
                )}
              </li>
            ))}
          </ul>
        )}

        {/* cliente nova: sem números zerados, só o essencial */}
        {hasVisits && (
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
        )}

        <div className={`profile__return ${overdue > 0 && !upcoming ? 'is-late' : ''}`}>
          {upcoming ? (
            <>
              <CalendarCheck size={18} aria-hidden="true" />
              <p>
                Próximo horário: <strong>{format(upcoming.date, "EEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })}</strong> · {upcoming.service}
                {upcoming.status === 'pendente' && ' (aguardando confirmação)'}
              </p>
            </>
          ) : overdue > 0 ? (
            <>
              <AlertTriangle size={18} aria-hidden="true" />
              <p>
                {days > MISSING_AFTER ? `${firstName} sumiu há ${days} dias.` : `Retorno atrasado ${overdue} ${overdue === 1 ? 'dia' : 'dias'}.`}{' '}
                <strong>Mande um convite com cupom de retorno.</strong>
              </p>
              <button type="button" className="btn btn--light btn--sm" onClick={() => setMessage(days > MISSING_AFTER ? 'sumida' : 'manutencao')}>
                Enviar convite
              </button>
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

      <div className="ftabs" role="tablist" aria-label={`Ficha de ${firstName}`}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="ftabs__item"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'ficha' && !fileDone && <span className="ftabs__dot" aria-label="pendente" />}
            {t.id === 'notas' && notes.notes.length > 0 && <span className="ftabs__count">{notes.notes.length}</span>}
          </button>
        ))}
      </div>

      <div className="detail-grid" role="tabpanel">
        {tab === 'resumo' && (
          <>
            <LoyaltyCard
              client={client}
              settings={book.loyaltySettings}
              canManage={book.canManage}
              onAdd={(stamps, note) => book.addLoyalty(client.id, stamps, note)}
              onRemove={(entryId) => book.removeLoyalty(client.id, entryId)}
              onSettings={onLoyaltySettings}
            />
            <CareCard
              key={client.id}
              client={client}
              onSave={(care) => book.updateCare(client.id, care)}
              onOpenFile={() => setTab('ficha')}
            />
            {!fileDone && (
              <Card className="detail-grid__wide filecta">
                <FileSignature size={22} aria-hidden="true" />
                <div>
                  <h3 className="card__title">
                    {client.anamnesisSignedAt ? 'Complete a anamnese' : `${firstName} ainda não assinou a ficha`}
                  </h3>
                  <p className="card__sub">Anamnese e termo de consentimento antes do próximo atendimento, direto no celular.</p>
                </div>
                <Button size="sm" onClick={() => setFileOpen(true)}>
                  Preencher ficha
                </Button>
              </Card>
            )}
            <HistoryCard appointments={client.appointments} proName={proName} limit={3} onSeeAll={() => setTab('historico')} />
            <PhotosCard
              photos={photos.photos}
              loading={photos.loading}
              error={photos.error}
              limit={4}
              onAdd={() => setAddingPhotos(true)}
              onOpen={setViewing}
              onSeeAll={() => setTab('ficha')}
            />
          </>
        )}

        {tab === 'ficha' && (
          <>
            <PersonalCard client={client} professionals={professionals} onEdit={onEdit} />
            <AnamnesisSummary client={client} onOpen={() => setFileOpen(true)} />
            <PhotosCard
              photos={photos.photos}
              loading={photos.loading}
              error={photos.error}
              onAdd={() => setAddingPhotos(true)}
              onOpen={setViewing}
            />
          </>
        )}

        {fileOpen && (
          <AnamnesisDialog
            client={client}
            salonName={salonName}
            onSave={(a) => book.saveAnamnesis(client.id, a)}
            onSign={(sig) => book.signAnamnesis(client.id, sig)}
            onClose={() => setFileOpen(false)}
          />
        )}

        {message && (
          <MessageDialog
            phone={client.phone}
            kinds={CLIENT_KINDS}
            initial={message}
            context={{ clientName: client.name, ...salonInfo, reward: book.loyaltySettings.reward }}
            onClose={() => setMessage(null)}
          />
        )}
        {addingPhotos && <AddPhotosDialog onSave={photos.add} onClose={() => setAddingPhotos(false)} />}
        {viewing && (
          <PhotoViewer
            photos={photos.photos}
            startId={viewing}
            loadFull={photos.loadFull}
            onRemove={photos.remove}
            onClose={() => setViewing(null)}
          />
        )}

        {tab === 'historico' && <HistoryCard appointments={client.appointments} proName={proName} />}

        {tab === 'notas' && (
          <NotesCard
            key={`n-${client.id}`}
            notes={notes.notes}
            loading={notes.loading}
            loadError={notes.error}
            onAdd={notes.add}
            onRemove={notes.remove}
          />
        )}
      </div>
    </div>
  )
}

export default function Clientes() {
  const today = useMemo(() => new Date(), [])
  const book = useClientBook()
  const { clients, professionals } = book
  const { salon } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const isWide = useMediaQuery('(min-width: 1100px)')
  const [dialog, setDialog] = useState<'new' | 'edit' | 'loyalty' | null>(null)

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
      {dialog === 'loyalty' && (
        <LoyaltySettingsDialog settings={book.loyaltySettings} onSave={book.saveLoyaltySettings} onClose={() => setDialog(null)} />
      )}
    </>
  )

  const detail = (showBack: boolean) =>
    selected && (
      <ClientDetail
        client={selected}
        today={today}
        showBack={showBack}
        book={book}
        salonName={salon?.name ?? ''}
        onEdit={() => setDialog('edit')}
        onLoyaltySettings={() => setDialog('loyalty')}
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

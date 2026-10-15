import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, ArrowLeft, AtSign, Briefcase, Cake, CalendarCheck, CalendarPlus, FileSignature, Heart, MessageCircle, Pencil, Phone, Sparkles, Trash2 } from 'lucide-react'
import type { Client } from '../../data/clients'
import { useClientBook, useClientNotes, useClientPhotos } from '../../data/useClientBook'
import { TAG_LABEL, awaitsConfirmation, clientProfile, lastVisitLabel, type ReturnState } from '../../domain/clients'
import { AddPhotosDialog, PhotoViewer, PhotosCard } from '../../components/ClientPhotos'
import { AnamnesisDialog, AnamnesisSummary, CareCard, HistoryCard, NotesCard, PersonalCard } from '../../components/ClientFile'
import { MessageDialog } from '../../components/MessageDialog'
import { Avatar, Button, Card, Money, Tabs, Tag, Tags } from '../../components/ui'
import { useSalonInfo } from '../../hooks/useSalonInfo'
import { answeredCount } from '../../lib/anamnesis'
import { formatBRL } from '../../lib/format'
import { CLIENT_KINDS, type MessageKind } from '../../lib/messages'
import { agenda, dash } from '../../lib/routes'
import './Clientes.css'

type DetailTab = 'resumo' | 'ficha' | 'historico' | 'notas'

/** a faixa do perfil que diz o que fazer com a cliente: próximo horário, atraso, convite ou nada ainda */
function ReturnBanner({ state, firstName, days, onInvite }: { state: ReturnState; firstName: string; days: number; onInvite: (kind: MessageKind) => void }) {
  if (state.kind === 'upcoming') {
    return (
      <>
        <CalendarCheck size={18} aria-hidden="true" />
        <p>
          Próximo horário: <strong>{format(state.when, "EEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })}</strong> · {state.service}
          {state.awaiting && ' (aguardando confirmação)'}
        </p>
      </>
    )
  }
  if (state.kind === 'missing' || state.kind === 'late') {
    const missing = state.kind === 'missing'
    return (
      <>
        <AlertTriangle size={18} aria-hidden="true" />
        <p>
          {missing ? `${firstName} sumiu há ${state.days} dias.` : `Retorno atrasado ${state.days} ${state.days === 1 ? 'dia' : 'dias'}.`}{' '}
          <strong>Mande um convite com cupom de retorno.</strong>
        </p>
        <button type="button" className="btn btn--light btn--sm" onClick={() => onInvite(missing ? 'sumida' : 'manutencao')}>
          Enviar convite
        </button>
      </>
    )
  }
  if (state.kind === 'expected') {
    return (
      <>
        <Sparkles size={18} aria-hidden="true" />
        <p>
          Próxima visita prevista para <strong>{format(state.on, "dd 'de' MMMM", { locale: ptBR })}</strong>. {lastVisitLabel(days)}.
        </p>
      </>
    )
  }
  return (
    <>
      <Sparkles size={18} aria-hidden="true" />
      <p>Ainda sem atendimentos concluídos. O histórico e o retorno aparecem depois do primeiro.</p>
    </>
  )
}

/** ficha da cliente: perfil com números e retorno, e as abas Resumo, Ficha, Histórico e Anotações */
export function ClientDetail({
  client,
  today,
  showBack,
  book,
  salonName,
  onEdit,
  onForget,
}: {
  client: Client
  today: Date
  showBack: boolean
  book: ReturnType<typeof useClientBook>
  salonName: string
  onEdit: () => void
  /** só a dona: apagar os dados da cliente (LGPD) */
  onForget?: () => void
}) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<DetailTab>('resumo')
  const [fileOpen, setFileOpen] = useState(false)
  const [message, setMessage] = useState<MessageKind | null>(null)
  const [addingPhotos, setAddingPhotos] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const salonInfo = useSalonInfo()
  const photos = useClientPhotos(client.id)
  const notes = useClientNotes(client.id)
  const { professionals } = book
  const proName = (id: string) => professionals.find((p) => p.id === id)?.name ?? ''
  const profile = clientProfile(client, today, answeredCount(client.anamnesis))
  const firstName = client.name.split(' ')[0]
  const digits = client.phone.replace(/\D/g, '')
  const late = profile.returnState.kind === 'late' || profile.returnState.kind === 'missing'

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

      <Card className="profile">
        <div className="profile__top">
          <div className="profile__who">
            <Avatar name={client.name} size="lg" />
            <div>
              <h2 className="profile__name">{client.name}</h2>
              <p className="card__sub">
                Cliente desde {format(client.since, "MMM 'de' yyyy", { locale: ptBR })}
                {proName(client.professionalId) && ` · com ${proName(client.professionalId)}`}
              </p>
              {(profile.tags.length > 0 || awaitsConfirmation(client, today)) && (
                <Tags>
                  {awaitsConfirmation(client, today) && <Tag tone="aconfirmar">A confirmar</Tag>}
                  {profile.tags.map((t) => (
                    <Tag key={t} tone={t}>
                      {TAG_LABEL[t]}
                    </Tag>
                  ))}
                </Tags>
              )}
            </div>
          </div>
          <div className="profile__actions">
            <button type="button" className="roundbtn" aria-label={`Mensagem no WhatsApp para ${firstName}`} onClick={() => setMessage(profile.suggested)}>
              <MessageCircle size={18} />
            </button>
            {digits && (
              <a className="roundbtn" href={`tel:${digits}`} aria-label={`Ligar para ${firstName}`}>
                <Phone size={18} />
              </a>
            )}
            <button type="button" className="roundbtn" aria-label={`Editar ${firstName}`} onClick={onEdit}>
              <Pencil size={18} />
            </button>
            {onForget && (
              <button type="button" className="roundbtn" aria-label={`Apagar dados de ${firstName}`} title="Apagar dados (LGPD)" onClick={onForget}>
                <Trash2 size={18} />
              </button>
            )}
            <Button variant="accent" icon aria-label={`Agendar ${firstName}`} onClick={() => navigate(agenda(`nova=1&cliente=${encodeURIComponent(client.name)}`))}>
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
        {profile.hasVisits && (
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
              <p className="profile__num">{formatBRL(profile.ticket).replace(',00', '')}</p>
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

        <div className={`profile__return ${late ? 'is-late' : ''}`.trim()}>
          <ReturnBanner state={profile.returnState} firstName={firstName} days={profile.days} onInvite={setMessage} />
        </div>
      </Card>

      <Tabs
        label={`Ficha de ${firstName}`}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'resumo', label: 'Resumo' },
          { id: 'ficha', label: 'Ficha', badge: profile.fileDone ? null : 'pendente' },
          { id: 'historico', label: 'Histórico' },
          { id: 'notas', label: 'Anotações', badge: notes.notes.length > 0 ? notes.notes.length : null },
        ]}
      />

      <div className="detail-grid" role="tabpanel">
        {tab === 'resumo' && (
          <>
            {!profile.fileDone && (
              <Card className="detail-grid__wide filecta">
                <FileSignature size={22} aria-hidden="true" />
                <div>
                  <h3 className="card__title">{client.anamnesisSignedAt ? 'Complete a anamnese' : `${firstName} ainda não assinou a ficha`}</h3>
                  <p className="card__sub">Anamnese e termo de consentimento antes do próximo atendimento, direto no celular.</p>
                </div>
                <Button size="sm" onClick={() => setFileOpen(true)}>
                  Preencher ficha
                </Button>
              </Card>
            )}
            <CareCard key={client.id} client={client} onSave={(care) => book.updateCare(client.id, care)} onOpenFile={() => setTab('ficha')} />
            <HistoryCard appointments={client.appointments} proName={proName} compact onSeeAll={() => setTab('historico')} />
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
            <PhotosCard photos={photos.photos} loading={photos.loading} error={photos.error} onAdd={() => setAddingPhotos(true)} onOpen={setViewing} />
          </>
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
          context={{ clientName: client.name, ...salonInfo }}
          onClose={() => setMessage(null)}
        />
      )}
      {addingPhotos && <AddPhotosDialog onSave={photos.add} onClose={() => setAddingPhotos(false)} />}
      {viewing && (
        <PhotoViewer photos={photos.photos} startId={viewing} loadFull={photos.loadFull} onRemove={photos.remove} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

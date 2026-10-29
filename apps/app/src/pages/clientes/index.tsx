import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useClientBook } from '../../data/useClientBook'
import { summarizeBook } from '../../domain/clients'
import { ClientDialog } from '../../components/ClientDialog'
import { Button, Card, Em, PageHeader } from '../../components/ui'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { dash } from '../../lib/routes'
import { ClientDetail } from './ClientDetail'
import { ForgetClientDialog } from './ForgetClientDialog'
import { ClientList } from './ClientList'
import './Clientes.css'
import { PageLoader } from '../../components/PageLoader'
import { EmptyBunny } from '../../components/BunnyMark'

/** Clientes: a lista de contatos ao lado da ficha da cliente escolhida (no celular, uma de cada vez) */
export default function Clientes() {
  const today = useMemo(() => new Date(), [])
  const book = useClientBook()
  const { clients, professionals } = book
  const { salon } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const isWide = useMediaQuery('(min-width: 1100px)')
  const [dialog, setDialog] = useState<'new' | 'edit' | 'forget' | null>(null)
  const [params, setParams] = useSearchParams()
  // quem a lista mostra agora (busca + filtro); null até a lista medir
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null)
  const onVisible = useCallback((ids: string[]) => setVisibleIds(ids), [])

  // /dashboard/clientes?nova=1 abre o cadastro de cliente (atalho do botão direito)
  useEffect(() => {
    if (params.get('nova') !== '1') return
    setDialog('new')
    setParams({}, { replace: true })
  }, [params, setParams])

  // no computador a ficha acompanha a lista: se a busca ou o filtro esconde a cliente aberta, abre a primeira que aparece
  const shown = isWide && visibleIds ? clients.filter((c) => visibleIds.includes(c.id)) : clients
  const selected = shown.find((c) => c.id === id) ?? (isWide ? shown[0] : clients.find((c) => c.id === id))
  const summary = useMemo(() => summarizeBook(clients, today), [clients, today])

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
      {dialog === 'forget' && selected && (
        <ForgetClientDialog
          name={selected.name}
          hasHistory={selected.visits > 0 || selected.appointments.length > 0}
          onForget={async () => {
            const message = await book.forget(selected.id)
            if (!message) navigate(dash('/clientes'))
            return message
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'edit' && selected && (
        <ClientDialog client={selected} professionals={professionals} onClose={() => setDialog(null)} onSave={(draft) => book.update(selected.id, draft)} />
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
        onForget={book.canForget ? () => setDialog('forget') : undefined}
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
      <PageHeader
        title={
          <>
            Seus <Em>contatos</Em>
          </>
        }
        // a linha do resumo existe desde o início (carregando ou vazia) para o título e o botão não pularem
        crumb={
          book.loading ? (
            'Carregando…'
          ) : clients.length === 0 ? (
            'Nenhum contato ainda'
          ) : (
            <span className="crm__summary">
              <span>{summary.newOnes} {summary.newOnes === 1 ? 'nova' : 'novas'} no mês</span>
              <span>{summary.returningPct}% voltam</span>
              <span className={summary.missing > 0 ? 'is-alert' : undefined}>
                {summary.missing} {summary.missing === 1 ? 'sumida' : 'sumidas'}
              </span>
            </span>
          )
        }
        actions={
          <Button size="sm" onClick={() => setDialog('new')}>
            <Plus size={16} aria-hidden="true" /> Nova cliente
          </Button>
        }
      />

      {book.error && (
        <p className="dialog__error" role="alert">
          {book.error}{' '}
          <button type="button" className="textlink" onClick={book.reload}>
            Tentar de novo
          </button>
        </p>
      )}

      {book.loading ? (
        <PageLoader label="Carregando clientes…" />
      ) : clients.length === 0 ? (
        <Card className="agenda__empty agenda__empty--center">
          <EmptyBunny />
          <h2 className="card__title">Cadastre sua primeira cliente</h2>
          <p className="card__sub">Elas também entram aqui sozinhas quando você faz um agendamento novo na agenda.</p>
          <Button onClick={() => setDialog('new')}>
            <Plus size={16} aria-hidden="true" /> Nova cliente
          </Button>
        </Card>
      ) : (
        <div className="crm">
          <ClientList clients={clients} selectedId={selected?.id} today={today} onVisible={onVisible} showValues={book.showValues} />
          {detail(false) || (
            <Card className="crm__none">
              <p className="card__title">Nenhuma cliente neste filtro</p>
              <p className="card__sub">Troque o filtro ou a busca para abrir a ficha de alguém.</p>
            </Card>
          )}
        </div>
      )}
      {dialogs}
    </div>
  )
}

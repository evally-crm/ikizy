import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useClientBook } from '../../data/useClientBook'
import { summarizeBook } from '../../domain/clients'
import { ClientDialog } from '../../components/ClientDialog'
import { Button, Card, Em, PageHeader, StatTile } from '../../components/ui'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { dash } from '../../lib/routes'
import { ClientDetail } from './ClientDetail'
import { ClientList } from './ClientList'
import './Clientes.css'

/** Clientes: a lista de contatos ao lado da ficha da cliente escolhida (no celular, uma de cada vez) */
export default function Clientes() {
  const today = useMemo(() => new Date(), [])
  const book = useClientBook()
  const { clients, professionals } = book
  const { salon } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const isWide = useMediaQuery('(min-width: 1100px)')
  const [dialog, setDialog] = useState<'new' | 'edit' | null>(null)
  const [params, setParams] = useSearchParams()

  // /dashboard/clientes?nova=1 abre o cadastro de cliente (atalho do botão direito)
  useEffect(() => {
    if (params.get('nova') !== '1') return
    setDialog('new')
    setParams({}, { replace: true })
  }, [params, setParams])

  const selected = clients.find((c) => c.id === id) ?? (isWide ? clients[0] : undefined)
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
        actions={
          <Button size="sm" onClick={() => setDialog('new')}>
            <Plus size={16} aria-hidden="true" /> Nova cliente
          </Button>
        }
      />

      {clients.length > 0 && (
        <div className="crmtiles">
          <StatTile label="Ativas" value={summary.active} />
          <StatTile label="Novas no mês" value={summary.newOnes} />
          <StatTile label="Retorno" value={`${summary.returningPct}%`} hint="com mais de uma visita" />
          <StatTile label="Sumidas" value={summary.missing} tone={summary.missing > 0 ? 'brand' : 'default'} hint="sem vir há mais de 45 dias" />
        </div>
      )}

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

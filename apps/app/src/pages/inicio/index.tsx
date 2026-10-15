import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAgenda } from '../../data/AgendaProvider'
import { useAuth } from '../../auth/AuthProvider'
import { appointmentsOn, nextStep, summarizeDay } from '../../domain/agenda'
import { dayKey } from '../../lib/agendaTime'
import { agenda, requestLink } from '../../lib/routes'
import { Card, PageHeader } from '../../components/ui'
import { DayAgenda } from '../../components/DayAgenda'
import { PendingBanner } from '../../components/PendingRequests'
import { TodayMessages } from '../../components/TodayMessages'
import { AppointmentMessageDialog } from '../../components/MessageDialog'
import type { Appointment } from '../../types'
import { TodayHero } from './TodayHero'
import './Inicio.css'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** frase de abertura: o que o dia tem e o que espera resposta */
function headline(count: number, upcoming: number, awaiting: number) {
  const requests = awaiting > 0 ? `${plural(awaiting, 'pedido', 'pedidos')} para confirmar` : ''
  if (upcoming > 0) return `Você tem ${plural(upcoming, 'atendimento', 'atendimentos')} pela frente hoje${requests ? ` e ${requests}` : ''}.`
  const day = count === 0 ? 'Agenda livre hoje.' : 'Os atendimentos de hoje já passaram.'
  return requests ? `${day} Você tem ${requests}.` : day
}

/**
 * Início: o que pede atenção agora. Números do dia, pedidos do site, a lista de hoje e quem chamar.
 * Só leitura e ações rápidas; para mexer na agenda, cada atendimento abre a Agenda no dia certo.
 */
export default function Inicio() {
  const { professionals, appointments, pending, workingHours, loading, error, focus, reload, update } = useAgenda()
  const { displayName } = useAuth()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())
  const [messaging, setMessaging] = useState<Appointment | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => focus(new Date()), [focus])

  const notify = useCallback((message: string) => setToast(message), [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])

  const today = dayKey(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const items = useMemo(() => appointmentsOn(appointments, today), [appointments, today])
  const summary = useMemo(() => summarizeDay(appointments, today, nowMinutes), [appointments, today, nowMinutes])
  const upcoming = items.filter((a) => (a.status === 'pendente' || a.status === 'confirmado' || a.status === 'atendimento') && a.start + a.duration > nowMinutes).length
  const professionalName = (id: string) => professionals.find((p) => p.id === id)?.name ?? ''
  const solo = professionals.length === 1
  const firstName = displayName.split(' ')[0] || displayName

  const open = (a: Appointment) => navigate(requestLink(a.id))

  /** mesmo botão do momento da Agenda: confirmar e iniciar aqui mesmo; concluir abre o atendimento lá (pede o pagamento) */
  const advance = async (a: Appointment) => {
    const step = nextStep(a.status)
    if (step === 'conclude') return open(a)
    const message = await update(a.id, { status: step === 'confirm' ? 'confirmado' : 'atendimento' })
    if (message) return notify(message)
    notify(`${a.client}: ${step === 'confirm' ? 'confirmado' : 'em atendimento'}`)
    if (step === 'confirm' && a.phone.replace(/\D/g, '')) setMessaging({ ...a, status: 'confirmado' })
  }

  return (
    <div className="page inicio">
      <PageHeader title={`Olá, ${firstName}`} crumb={loading ? 'Carregando o seu dia…' : headline(summary.count, upcoming, pending?.length ?? 0)} />

      {error && (
        <p className="dialog__error" role="alert">
          {error}{' '}
          <button type="button" className="textlink" onClick={reload}>
            Tentar de novo
          </button>
        </p>
      )}

      {!loading && professionals.length === 0 && !error ? (
        <Card className="inicio__setup">
          <h2 className="card__title">Vamos montar sua agenda</h2>
          <p className="card__sub">Cadastre quem atende para começar a marcar horários.</p>
          <Link to={agenda()} className="textlink">
            Abrir agenda
          </Link>
        </Card>
      ) : (
        <div className="inicio__grid">
          <div className="inicio__main">
            {!loading && (
              <TodayHero
                summary={summary}
                upcoming={upcoming}
                siteRequests={pending?.length ?? 0}
                professionalName={professionalName}
                onNext={open}
                onRequests={() => document.querySelector('.pendbanner')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                onNew={() => navigate(agenda('nova=1'))}
              />
            )}

            <PendingBanner onOpen={(id) => navigate(requestLink(id))} notify={notify} />

            <Card className="inicio__today">
              <div className="card__head">
                <div>
                  <h2 className="card__title">Hoje</h2>
                  <p className="card__sub">{format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                </div>
                <Link to={agenda()} className="textlink">
                  Ver agenda
                </Link>
              </div>
              <DayAgenda
                items={items}
                professionals={professionals}
                showPro={!solo}
                hours={solo ? workingHours[professionals[0].id] : undefined}
                weekday={now.getDay()}
                isToday
                isPast={false}
                nowMinutes={nowMinutes}
                loading={loading}
                onOpen={open}
                onStep={(a) => void advance(a)}
                onMessage={setMessaging}
                onNew={() => navigate(agenda('nova=1'))}
              />
            </Card>
          </div>

          <aside className="inicio__side">
            <TodayMessages clientsOnly />
          </aside>
        </div>
      )}

      {messaging && <AppointmentMessageDialog appointment={messaging} onClose={() => setMessaging(null)} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

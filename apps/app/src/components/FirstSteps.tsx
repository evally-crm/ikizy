import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useSubscription } from '../billing/SubscriptionProvider'
import { useAgenda } from '../data/AgendaProvider'
import { isNeonConfigured, neon } from '../lib/neon'
import { dash } from '../lib/routes'
import { Button, Card, Em } from './ui'

interface Step {
  id: string
  title: string
  text: string
  done: boolean
  to: string
  cta: string
}

const HIDE_KEY = (salonId: string) => `ikizy:primeiros-passos:${salonId}`

function readHidden(salonId: string) {
  try {
    return localStorage.getItem(HIDE_KEY(salonId)) === '1'
  } catch {
    return false
  }
}

/** o que o checklist precisa saber do site e da equipe (o resto vem da agenda) */
function useSetupFacts() {
  const { salon } = useAuth()
  const [facts, setFacts] = useState<{ published: boolean; online: boolean; team: number } | null>(() =>
    isNeonConfigured ? null : { published: true, online: false, team: 1 },
  )
  useEffect(() => {
    if (!neon || !salon?.id) return
    let alive = true
    void Promise.all([
      neon.from('site_settings').select('published, online_booking').eq('salon_id', salon.id).maybeSingle(),
      neon.from('members').select('user_id', { count: 'exact', head: true }).eq('salon_id', salon.id),
    ]).then(([site, members]) => {
      if (!alive) return
      const row = (site.data ?? {}) as { published?: boolean; online_booking?: boolean }
      setFacts({ published: row.published === true, online: row.online_booking === true, team: members.count ?? 1 })
    })
    return () => {
      alive = false
    }
  }, [salon?.id])
  return facts
}

/**
 * Primeiros passos no Início: leva o salão do cadastro até receber o primeiro agendamento pelo site.
 * Some sozinho quando tudo está feito; a dona também pode esconder.
 */
export default function FirstSteps() {
  const { salon } = useAuth()
  const { sub } = useSubscription()
  const { loading, professionals, services, workingHours, hoursAvailable, appointments } = useAgenda()
  const facts = useSetupFacts()
  const salonId = salon?.id ?? 'demo'
  const [hidden, setHidden] = useState(() => readHidden(salonId))

  // só quem monta o negócio (dona e gerente) vê o checklist
  if (salon && salon.role !== 'owner' && salon.role !== 'manager') return null
  if (hidden || loading || !facts) return null

  const priced = services.filter((s) => s.price > 0)
  const withHours = professionals.filter((p) => (workingHours[p.id]?.length ?? 0) > 0)
  const hasTeamPlan = sub?.plan === 'studio' || sub?.plan === 'salao'

  const steps: Step[] = [
    {
      id: 'servicos',
      title: 'Cadastre seus serviços',
      text: 'Com preço e duração, para a agenda e o site já saberem quanto tempo cada um leva.',
      done: priced.length > 0,
      to: `${dash('/site')}?etapa=servicos`,
      cta: 'Ver serviços',
    },
    {
      id: 'horario',
      title: 'Defina seu horário de atendimento',
      text: 'Os dias e horários em que você atende. O site só oferece horários dentro dele.',
      done: hoursAvailable && professionals.length > 0 && withHours.length === professionals.length,
      to: `${dash('/agenda')}?horarios=1`,
      cta: 'Definir horário',
    },
    {
      id: 'site',
      title: 'Publique seu site',
      text: 'Escolha as cores e o nome. Em 2 minutos sua página está no ar.',
      done: facts.published,
      to: `${dash('/site')}?guia=1`,
      cta: 'Criar meu site',
    },
    {
      id: 'online',
      title: 'Ligue o agendamento online',
      text: 'A cliente escolhe o horário pelo site e o pedido chega aqui para você confirmar.',
      done: facts.online,
      to: dash('/site'),
      cta: 'Ligar agendamento',
    },
    ...(hasTeamPlan
      ? [
          {
            id: 'equipe',
            title: 'Chame sua equipe',
            text: 'Cada profissional entra com o próprio login e vê a própria agenda.',
            done: facts.team > 1,
            to: dash('/equipe'),
            cta: 'Convidar',
          },
        ]
      : []),
    {
      id: 'agenda',
      title: 'Marque o primeiro atendimento',
      text: 'Toque num horário livre da agenda e cadastre a cliente na hora.',
      done: appointments.length > 0,
      to: dash('/agenda'),
      cta: 'Abrir agenda',
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null
  const next = steps.find((s) => !s.done)

  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY(salonId), '1')
    } catch {
      /* sem armazenamento: some só nesta visita */
    }
    setHidden(true)
  }

  return (
    <Card className="steps">
      <div className="steps__head">
        <div>
          <p className="steps__count">
            {doneCount} de {steps.length} prontos
          </p>
          <h2 className="steps__title">
            Primeiros <Em>passos</Em>
          </h2>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Esconder primeiros passos" title="Esconder" onClick={hide}>
          <X size={16} />
        </Button>
      </div>
      <div className="wiz__progress steps__bar" role="progressbar" aria-label="Progresso" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
        {steps.map((s) => (
          <span key={s.id} className={s.done ? 'is-done' : undefined} />
        ))}
      </div>
      <ol className="steps__list">
        {steps.map((s) => (
          <li key={s.id} className={`steps__item ${s.done ? 'is-done' : ''} ${s === next ? 'is-next' : ''}`}>
            <span className="steps__mark" aria-hidden="true">
              {s.done ? <Check size={14} /> : null}
            </span>
            <div className="steps__body">
              <p className="steps__name">
                {s.title}
                {s.done && <span className="sr-only"> (feito)</span>}
              </p>
              {s === next && <p className="steps__text">{s.text}</p>}
            </div>
            {!s.done && (
              <Link to={s.to} className={`steps__go ${s === next ? 'is-primary' : ''}`}>
                {s === next ? s.cta : <ArrowRight size={16} aria-label={s.cta} />}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}

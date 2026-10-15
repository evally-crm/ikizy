import './FirstSteps.css'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useAgenda } from '../data/AgendaProvider'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { neon } from '../lib/neon'
import { dash } from '../lib/routes'

/** painel aberto ou recolhido, guardado neste aparelho, por negócio */
const minKey = (salonId: string) => `ikizy:primeiros-passos-min:${salonId}`
/** passou da última etapa: o painel não volta mais */
const doneKey = (salonId: string) => `ikizy:primeiros-passos-feito:${salonId}`
const CELEBRATE_MS = 4200

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // sem armazenamento: vale só nesta visita
  }
}

/** site publicado e agendamento online ligado (no modo demonstração: publicado, agendamento desligado); relê ao trocar de tela */
function useSiteState(pathname: string) {
  const { salon, status } = useAuth()
  const [state, setState] = useState<{ published: boolean; online: boolean } | null>(status === 'demo' ? { published: true, online: false } : null)
  useEffect(() => {
    if (!neon || !salon?.id) return
    let cancelled = false
    void neon
      .from('site_settings')
      .select('published, online_booking')
      .eq('salon_id', salon.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { published?: boolean; online_booking?: boolean } | null
        if (!cancelled) setState({ published: Boolean(row?.published), online: Boolean(row?.online_booking) })
      })
    return () => {
      cancelled = true
    }
  }, [salon?.id, pathname])
  return state
}

/** anel de progresso do botão recolhido */
function Ring({ done, total }: { done: number; total: number }) {
  const r = 11
  const c = 2 * Math.PI * r
  return (
    <svg className="setup__ring" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <circle cx="15" cy="15" r={r} fill="none" strokeWidth="3" className="setup__ring-bg" />
      <circle
        cx="15"
        cy="15"
        r={r}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className="setup__ring-fg"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - done / total)}
        transform="rotate(-90 15 15)"
      />
    </svg>
  )
}

/**
 * guia do começo, como um painel flutuante no canto: horário, preços, site e agendamento online.
 * Dá para recolher num botão pequeno; some sozinho quando tudo está feito. Só para dona e gerente.
 */
export function FirstSteps() {
  const { salon } = useAuth()
  const { professionals, services, workingHours, loading } = useAgenda()
  const { pathname } = useLocation()
  const site = useSiteState(pathname)
  const wide = useMediaQuery('(min-width: 1024px)')
  const salonKey = salon?.id ?? 'demo'
  const canManage = !salon || salon.role === 'owner' || salon.role === 'manager'

  const [minimized, setMinimized] = useState<boolean | null>(null)
  const [finished, setFinished] = useState(() => read(doneKey(salonKey)) === '1')
  const [celebrate, setCelebrate] = useState(false)
  // só comemora se o painel chegou a mostrar etapas pendentes nesta visita
  const sawPending = useRef(false)

  const unpriced = services.filter((s) => s.price <= 0).length
  const steps = [
    {
      id: 'horario',
      done: professionals.some((p) => (workingHours[p.id]?.length ?? 0) > 0),
      title: 'Confira seu horário de atendimento',
      detail: 'Começa em seg a sáb, 9h às 19h.',
      to: dash('/negocio#horario'),
    },
    {
      id: 'precos',
      done: services.length > 0 && unpriced === 0,
      title: 'Coloque os preços dos serviços',
      detail: services.length === 0 ? 'Cadastre o que você faz.' : `${unpriced} ${unpriced === 1 ? 'serviço' : 'serviços'} sem preço.`,
      to: dash('/negocio#servicos'),
    },
    { id: 'site', done: Boolean(site?.published), title: 'Publique seu site', detail: 'Visual, textos e endereço da sua página.', to: dash('/site') },
    { id: 'online', done: Boolean(site?.online), title: 'Receba agendamentos pelo site', detail: 'As clientes marcam sozinhas.', to: dash('/site') },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const ready = !loading && Boolean(site) && canManage
  const allDone = doneCount === steps.length

  useEffect(() => {
    if (!ready || finished) return
    if (!allDone) {
      sawPending.current = true
      return
    }
    if (!sawPending.current) {
      // já estava tudo pronto antes de abrir: nada a mostrar
      write(doneKey(salonKey), '1')
      setFinished(true)
      return
    }
    setCelebrate(true)
    const timer = window.setTimeout(() => {
      write(doneKey(salonKey), '1')
      setCelebrate(false)
      setFinished(true)
    }, CELEBRATE_MS)
    return () => window.clearTimeout(timer)
  }, [ready, allDone, finished, salonKey])

  // o editor do site ocupa a tela toda: o painel espera do lado de fora
  if (!ready || finished || pathname.startsWith(dash('/site'))) return null

  // sem escolha guardada: aberto no computador, recolhido no celular (para não cobrir a agenda)
  const stored = read(minKey(salonKey))
  const isMin = celebrate ? false : (minimized ?? (stored === null ? !wide : stored === '1'))
  const setMin = (value: boolean) => {
    setMinimized(value)
    write(minKey(salonKey), value ? '1' : '0')
  }

  if (isMin) {
    return (
      <button type="button" className="setup setup--pill" onClick={() => setMin(false)} aria-label={`Primeiros passos, ${doneCount} de ${steps.length} feitos. Abrir`}>
        <Ring done={doneCount} total={steps.length} />
        <span>
          Primeiros passos <small>{doneCount}/{steps.length}</small>
        </span>
      </button>
    )
  }

  return (
    <section className={`setup setup--card ${celebrate ? 'is-done' : ''}`} aria-label="Primeiros passos" aria-live="polite">
      <header className="setup__head">
        <div>
          <h2 className="setup__title">{celebrate ? 'Tudo pronto!' : 'Deixe seu negócio pronto'}</h2>
          <p className="setup__sub">
            {celebrate ? 'Seu negócio já pode receber clientes.' : `${doneCount} de ${steps.length} feitos`}
          </p>
        </div>
        {!celebrate && (
          <button type="button" className="setup__min" onClick={() => setMin(true)} aria-label="Recolher">
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="setup__bar" aria-hidden="true">
        {steps.map((s) => (
          <span key={s.id} className={s.done ? 'is-done' : undefined} />
        ))}
      </div>
      {celebrate ? (
        <p className="setup__party">
          <Sparkles size={18} aria-hidden="true" /> Os 4 passos estão feitos.
        </p>
      ) : (
        <ol className="setup__list">
          {steps.map((s) => (
            <li key={s.id}>
              {s.done ? (
                <div className="setup__item is-done">
                  <span className="setup__check">
                    <Check size={14} aria-hidden="true" />
                  </span>
                  <span className="setup__text">
                    <strong>{s.title}</strong>
                  </span>
                </div>
              ) : (
                <Link to={s.to} className="setup__item">
                  <span className="setup__check" />
                  <span className="setup__text">
                    <strong>{s.title}</strong>
                    <small>{s.detail}</small>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

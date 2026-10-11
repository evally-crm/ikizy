import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useAgenda } from '../data/AgendaProvider'
import { neon } from '../lib/neon'
import { dash } from '../lib/routes'

/** "Depois" guarda neste aparelho, por negócio */
const hiddenKey = (salonId: string) => `ikizy:primeiros-passos-oculto:${salonId}`

/** site publicado e agendamento online ligado (no modo demonstração: publicado, agendamento desligado) */
function useSiteState() {
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
  }, [salon?.id])
  return state
}

/**
 * roteiro do começo, no topo da agenda: horário, preços, site e agendamento online.
 * Some sozinho quando tudo está feito, ou com "Depois". Só para quem cuida do negócio (dona e gerente).
 */
export function FirstSteps() {
  const { salon } = useAuth()
  const { professionals, services, workingHours, loading } = useAgenda()
  const site = useSiteState()
  const salonKey = salon?.id ?? 'demo'
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(hiddenKey(salonKey)) === '1'
    } catch {
      return false
    }
  })
  const canManage = !salon || salon.role === 'owner' || salon.role === 'manager'
  if (hidden || loading || !site || !canManage) return null

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
    { id: 'site', done: site.published, title: 'Publique seu site', detail: 'Visual e endereço em 2 passos.', to: dash('/site?guia=1') },
    { id: 'online', done: site.online, title: 'Receba agendamentos pelo site', detail: 'As clientes marcam sozinhas.', to: dash('/site') },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(hiddenKey(salonKey), '1')
    } catch {
      // sem armazenamento: some só nesta visita
    }
  }

  return (
    <section className="firststeps" aria-label="Primeiros passos">
      <div className="firststeps__head">
        <div>
          <h2 className="firststeps__title">Deixe seu negócio pronto</h2>
          <p className="firststeps__sub">
            {doneCount} de {steps.length} feitos
          </p>
        </div>
        <button type="button" className="textlink" onClick={hide}>
          Depois
        </button>
      </div>
      <div className="firststeps__bar" aria-hidden="true">
        {steps.map((s) => (
          <span key={s.id} className={s.done ? 'is-done' : undefined} />
        ))}
      </div>
      <ol className="firststeps__list">
        {steps
          .filter((s) => !s.done)
          .map((s) => (
            <li key={s.id}>
              <Link to={s.to} className="firststeps__item">
                <span className="firststeps__check" />
                <span className="firststeps__text">
                  <strong>{s.title}</strong>
                  <small>{s.detail}</small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </li>
          ))}
      </ol>
    </section>
  )
}

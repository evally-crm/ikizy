import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Clock, Globe, Loader2, Scissors } from 'lucide-react'
import './Finale.css'

const TASKS = ['Criando seu negócio', 'Colocando seus serviços', 'Abrindo seu horário', 'Preparando seu site']

/** quanto cada linha do "montando" leva para virar ✓ (a criação de verdade roda junto) */
export const BUILD_TICK_MS = 650

/** "Montando sua agenda…": as tarefas viram ✓ uma a uma enquanto o banco cria tudo */
export function Building() {
  const [done, setDone] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setDone((n) => (n < TASKS.length - 1 ? n + 1 : n)), BUILD_TICK_MS)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <ul className="onb-build" aria-live="polite">
      {TASKS.map((t, i) => (
        <li key={t} className={i < done ? 'onb-build__item onb-build__item--done' : i === done ? 'onb-build__item onb-build__item--now' : 'onb-build__item'}>
          <span className="onb-build__ico" aria-hidden="true">
            {i < done ? <Check size={14} /> : i === done ? <Loader2 size={14} className="ask__spin" /> : null}
          </span>
          {t}
        </li>
      ))}
    </ul>
  )
}

/** "Sua agenda está pronta": o que foi montado e o caminho para o plano */
export function Ready({
  serviceCount,
  hours,
  site,
  onContinue,
}: {
  serviceCount: number
  /** "Seg a Sáb · 09:00–19:00" */
  hours: string[]
  site: string
  onContinue: () => void
}) {
  return (
    <>
      <ul className="onb-done">
        <li>
          <CalendarDays size={18} aria-hidden="true" />
          <span>
            <b>Agenda</b> com você na coluna
          </span>
        </li>
        <li>
          <Clock size={18} aria-hidden="true" />
          <span>
            <b>Horário</b> {hours.join(' · ')}
          </span>
        </li>
        <li>
          <Scissors size={18} aria-hidden="true" />
          <span>
            <b>{serviceCount === 1 ? '1 serviço' : `${serviceCount} serviços`}</b> sem preço, para você completar
          </span>
        </li>
        <li>
          <Globe size={18} aria-hidden="true" />
          <span>
            <b>{site}</b> pronto para publicar
          </span>
        </li>
      </ul>
      <div className="ask-next">
        <button type="button" className="ask-next__btn" onClick={onContinue} autoFocus>
          Escolher meu plano
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </>
  )
}

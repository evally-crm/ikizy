import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bell, ChevronRight, Globe } from 'lucide-react'
import { useAgenda } from '../data/AgendaProvider'
import { formatTime } from '../lib/format'
import { requestLink } from '../lib/routes'
import type { Appointment } from '../types'
import { Avatar, Button } from './ui'

const plural = (n: number) => (n === 1 ? '1 pedido' : `${n} pedidos`)

/** "Hoje, 14:00", "Amanhã, 09:30" ou "Sex, 17 out, 10:00" */
function when(a: Appointment) {
  const day = parseISO(a.date)
  const label = isToday(day) ? 'Hoje' : isTomorrow(day) ? 'Amanhã' : format(day, "EEE, d MMM", { locale: ptBR }).replace('.', '')
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}, ${formatTime(a.start)}`
}

function RequestRow({ a, onOpen }: { a: Appointment; onOpen: (id: string) => void }) {
  const { professionals } = useAgenda()
  const pro = professionals.find((p) => p.id === a.professionalId)?.name
  return (
    <button type="button" className="pendrow" onClick={() => onOpen(a.id)}>
      <Avatar name={a.client} size="sm" soft />
      <span className="pendrow__text">
        <span className="pendrow__name">{a.client}</span>
        <span className="pendrow__meta">
          {a.service} · {when(a)}
          {pro && professionals.length > 1 ? ` · ${pro}` : ''}
        </span>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  )
}

/** sininho do topo: contagem de pedidos do site e a lista ao clicar; também põe a contagem no título da aba */
export function PendingBell() {
  const { pending } = useAgenda()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = pending?.length ?? 0

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '')
    document.title = count ? `(${count}) ${base}` : base
  }, [count])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  const go = (id: string) => {
    setOpen(false)
    navigate(requestLink(id))
  }

  return (
    <div className="pendbell" ref={ref}>
      <Button
        variant="soft"
        icon
        className="notif"
        aria-label={count ? `Pedidos do site: ${plural(count)} para confirmar` : 'Pedidos do site'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="notif__count" aria-hidden="true">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>
      {open && (
        <div className="pendpop" role="dialog" aria-label="Pedidos do site">
          <div className="pendpop__head">
            <p className="pendpop__title">Pedidos do site</p>
            <p className="pendpop__sub">{count ? `${plural(count)} para confirmar` : 'Nada esperando confirmação'}</p>
          </div>
          {count ? (
            <div className="pendpop__list">
              {pending!.map((a) => (
                <RequestRow key={a.id} a={a} onOpen={go} />
              ))}
            </div>
          ) : (
            <p className="pendpop__empty">Quando uma cliente agendar pelo seu site, o pedido aparece aqui para você confirmar.</p>
          )}
        </div>
      )}
    </div>
  )
}

/** faixa de destaque no Início e na Agenda: some quando não há pedidos */
export function PendingBanner({ onOpen }: { onOpen: (id: string) => void }) {
  const { pending } = useAgenda()
  if (!pending?.length) return null
  const shown = pending.slice(0, 3)
  return (
    <section className="pendbanner" aria-label="Pedidos do site para confirmar">
      <div className="pendbanner__head">
        <span className="pendbanner__icon">
          <Globe size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="pendbanner__title">
            {plural(pending.length)} do site para confirmar
          </h2>
          <p className="pendbanner__sub">A cliente espera sua resposta. Abra o pedido para confirmar ou recusar.</p>
        </div>
      </div>
      <div className="pendbanner__list">
        {shown.map((a) => (
          <RequestRow key={a.id} a={a} onOpen={onOpen} />
        ))}
      </div>
      {pending.length > shown.length && <p className="pendbanner__more">e mais {plural(pending.length - shown.length)} no sininho lá em cima</p>}
    </section>
  )
}

/** aviso rápido quando chega um pedido com o sistema aberto */
export function PendingToast() {
  const { pending } = useAgenda()
  const navigate = useNavigate()
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Appointment[]>([])

  useEffect(() => {
    if (!pending) return
    const known = seen.current
    seen.current = new Set(pending.map((a) => a.id))
    // primeira carga não avisa: o sininho e a faixa já mostram o que estava esperando
    if (!known) return
    const arrived = pending.filter((a) => !known.has(a.id))
    if (arrived.length) setFresh(arrived)
  }, [pending])

  useEffect(() => {
    if (!fresh.length) return
    const timer = window.setTimeout(() => setFresh([]), 10_000)
    return () => window.clearTimeout(timer)
  }, [fresh])

  if (!fresh.length) return null
  const first = fresh[0]
  return (
    <div className="toast toast--action" role="status">
      <span>
        {fresh.length === 1 ? `Novo pedido do site: ${first.client}, ${when(first).toLowerCase()}` : `${plural(fresh.length)} novos do site`}
      </span>
      <button
        type="button"
        onClick={() => {
          setFresh([])
          navigate(requestLink(first.id))
        }}
      >
        Ver
      </button>
    </div>
  )
}

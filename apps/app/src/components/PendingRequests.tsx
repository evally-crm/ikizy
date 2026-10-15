import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bell, ChevronDown, ChevronRight, Globe } from 'lucide-react'
import { useAgenda } from '../data/AgendaProvider'
import { formatTime } from '../lib/format'
import { requestLink } from '../lib/routes'
import type { Appointment } from '../types'
import { Avatar, Button } from './ui'
import { ConfirmDialog } from './Modal'
import { AppointmentMessageDialog } from './MessageDialog'
import { usePresence } from '../hooks/usePresence'

const plural = (n: number) => (n === 1 ? '1 pedido' : `${n} pedidos`)

/** "Hoje, 14:00", "Amanhã, 09:30" ou "Sex, 17 out, 10:00" */
function when(a: Appointment) {
  const day = parseISO(a.date)
  const label = isToday(day) ? 'Hoje' : isTomorrow(day) ? 'Amanhã' : format(day, "EEE, d MMM", { locale: ptBR }).replace('.', '')
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}, ${formatTime(a.start)}`
}

function RequestRow({
  a,
  onOpen,
  onConfirm,
  onDecline,
}: {
  a: Appointment
  onOpen: (id: string) => void
  /** com as ações, o pedido é respondido ali mesmo; sem elas, a linha só abre o pedido */
  onConfirm?: (a: Appointment) => void
  onDecline?: (a: Appointment) => void
}) {
  const { professionals } = useAgenda()
  const pro = professionals.find((p) => p.id === a.professionalId)?.name
  const main = (
    <button type="button" className="pendrow" onClick={() => onOpen(a.id)}>
      <Avatar name={a.client} size="sm" soft />
      <span className="pendrow__text">
        <span className="pendrow__name">{a.client}</span>
        <span className="pendrow__meta">
          {a.service} · {when(a)}
          {pro && professionals.length > 1 ? ` · ${pro}` : ''}
        </span>
      </span>
      {!onConfirm && <ChevronRight size={16} aria-hidden="true" />}
    </button>
  )
  if (!onConfirm || !onDecline) return main
  return (
    <div className="pendrow-wrap">
      {main}
      <div className="pendrow__actions">
        <button type="button" className="pendrow__no" onClick={() => onDecline(a)}>
          Recusar
        </button>
        <button type="button" className="pendrow__yes" onClick={() => onConfirm(a)}>
          Confirmar
        </button>
      </div>
    </div>
  )
}

/**
 * responder pedidos: confirmar é direto; recusar pede confirmação (libera a vaga).
 * Depois de responder, já abre a mensagem pronta para a cliente saber.
 */
function useRespond(notify?: (message: string) => void) {
  const { update } = useAgenda()
  const [declining, setDeclining] = useState<Appointment | null>(null)
  const [messaging, setMessaging] = useState<Appointment | null>(null)

  const answer = async (a: Appointment, status: 'confirmado' | 'cancelado') => {
    const error = await update(a.id, { status })
    if (error) return notify?.(error)
    notify?.(status === 'confirmado' ? `${a.client}: confirmado` : `Pedido de ${a.client} recusado`)
    if (a.phone.replace(/\D/g, '')) setMessaging({ ...a, status })
  }

  const dialogs = (
    <>
      {declining && (
        <ConfirmDialog
          title="Recusar este pedido?"
          text={`O horário de ${declining.client} (${when(declining).toLowerCase()}) volta a ficar livre. Em seguida você pode avisar a cliente pelo WhatsApp.`}
          confirmLabel="Recusar pedido"
          onClose={() => setDeclining(null)}
          onConfirm={() => {
            const a = declining
            setDeclining(null)
            void answer(a, 'cancelado')
          }}
        />
      )}
      {messaging && <AppointmentMessageDialog appointment={messaging} onClose={() => setMessaging(null)} />}
    </>
  )

  return { confirm: (a: Appointment) => void answer(a, 'confirmado'), decline: setDeclining, dialogs }
}

/** sininho do topo: contagem de pedidos do site e a lista ao clicar; também põe a contagem no título da aba */
export function PendingBell() {
  const { pending } = useAgenda()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const pop = usePresence(open)
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
      {pop.mounted && (
        <div className={`pendpop ${pop.closing ? 'is-closing' : ''}`.trim()} role="dialog" aria-label="Pedidos do site">
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

/**
 * faixa de pedidos do site na Agenda: confirmar ou recusar ali mesmo.
 * `collapsed`: no celular começa recolhida numa linha (os pedidos de hoje já aparecem na lista do dia).
 */
export function PendingBanner({
  onOpen,
  notify,
  collapsed = false,
}: {
  onOpen: (id: string) => void
  notify?: (message: string) => void
  collapsed?: boolean
}) {
  const { pending } = useAgenda()
  const { confirm, decline, dialogs } = useRespond(notify)
  const [open, setOpen] = useState(!collapsed)
  if (!pending?.length) return dialogs
  const shown = pending.slice(0, 3)
  return (
    <section className={`pendbanner ${open ? '' : 'pendbanner--closed'}`} aria-label="Pedidos do site para confirmar">
      <button type="button" className="pendbanner__head" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={!collapsed}>
        <span className="pendbanner__icon">
          <Globe size={18} aria-hidden="true" />
        </span>
        <span className="pendbanner__headtext">
          <span className="pendbanner__title">{plural(pending.length)} do site para confirmar</span>
          {open && <span className="pendbanner__sub">A cliente espera sua resposta.</span>}
        </span>
        {collapsed && <ChevronDown size={18} aria-hidden="true" className="pendbanner__chev" />}
      </button>
      {open && (
        <>
          <div className="pendbanner__list">
            {shown.map((a) => (
              <RequestRow key={a.id} a={a} onOpen={onOpen} onConfirm={confirm} onDecline={decline} />
            ))}
          </div>
          {pending.length > shown.length && <p className="pendbanner__more">e mais {plural(pending.length - shown.length)} no sininho lá em cima</p>}
        </>
      )}
      {dialogs}
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

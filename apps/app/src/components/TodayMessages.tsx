import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, format, parseISO } from 'date-fns'
import { Check, Send } from 'lucide-react'
import { useAgenda } from '../data/AgendaProvider'
import { useClientBook } from '../data/useClientBook'
import { MISSING_AFTER, daysSince } from '../domain/clients'
import {
  APPOINTMENT_KINDS,
  CLIENT_KINDS,
  MESSAGE_LABEL,
  markSent,
  sentKey,
  wasSent,
  type MessageContext,
  type MessageKind,
} from '../lib/messages'
import { formatTime } from '../lib/format'
import { dash } from '../lib/routes'
import { useSalonInfo } from '../hooks/useSalonInfo'
import { Avatar, Card } from './ui'
import { MessageDialog } from './MessageDialog'

interface Item {
  key: string
  kind: MessageKind
  kinds: MessageKind[]
  name: string
  phone: string
  detail: string
  context: Omit<MessageContext, 'salonName' | 'siteUrl'>
}

/**
 * lista do dia de quem vale uma mensagem: lembretes, pós-atendimento, aniversários e sumidas.
 * `clientsOnly`: só aniversário e sumidas ("Chamar hoje"), para quando cada atendimento já tem o próprio botão de mensagem.
 */
export function TodayMessages({ clientsOnly = false }: { clientsOnly?: boolean }) {
  const { appointments } = useAgenda()
  const { clients } = useClientBook()
  const salon = useSalonInfo()
  const [open, setOpen] = useState<Item | null>(null)
  const [, setTick] = useState(0)

  const now = useMemo(() => new Date(), [])
  const today = format(now, 'yyyy-MM-dd')
  const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd')
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const items = useMemo<Item[]>(() => {
    const list: Item[] = []
    const ofAppointments = [...appointments].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
    const push = (kind: MessageKind, id: string, item: Omit<Item, 'key' | 'kind'>) => list.push({ key: sentKey(kind, id, today), kind, ...item })

    for (const a of clientsOnly ? [] : ofAppointments) {
      const ctx = { clientName: a.client, service: a.service, date: a.date, start: a.start }
      const base = { kinds: APPOINTMENT_KINDS, name: a.client, phone: a.phone, context: ctx }
      const open = a.status === 'pendente' || a.status === 'confirmado'
      const future = a.date > today || (a.date === today && a.start >= nowMinutes)
      // pedido do site sem resposta: a cliente ainda não sabe se o horário está garantido
      if (a.status === 'pendente' && future) push('confirmacao', a.id, { ...base, detail: `Aguardando você · ${a.date === today ? 'hoje' : a.date === tomorrow ? 'amanhã' : format(parseISO(a.date), 'dd/MM')} às ${formatTime(a.start)}` })
      else if (a.date === today && open && a.start >= nowMinutes) push('hoje', a.id, { ...base, detail: `Hoje às ${formatTime(a.start)} · ${a.service}` })
      else if (a.date === tomorrow && open) push('lembrete', a.id, { ...base, detail: `Amanhã às ${formatTime(a.start)} · ${a.service}` })
      else if (a.date === today && a.status === 'concluido') push('pos', a.id, { ...base, detail: `Atendida hoje · ${a.service}` })
      else if (a.date === today && a.status === 'faltou') push('falta', a.id, { ...base, detail: `Faltou hoje às ${formatTime(a.start)}` })
    }

    const md = format(now, 'MM-dd')
    let missing = 0
    for (const c of clients) {
      const base = { kinds: CLIENT_KINDS, name: c.name, phone: c.phone, context: { clientName: c.name } }
      if (c.birthday === md) push('aniversario', c.id, { ...base, detail: 'Faz aniversário hoje 🎂' })
      else if (c.visits > 0 && daysSince(c.lastVisit, now) > MISSING_AFTER && missing < 5) {
        missing++
        push('sumida', c.id, { ...base, detail: `Sem vir há ${daysSince(c.lastVisit, now)} dias` })
      }
    }
    return list
  }, [appointments, clients, today, tomorrow, nowMinutes, now, clientsOnly])

  const pending = items.filter((i) => !wasSent(i.key)).length
  if (clientsOnly && items.length === 0) return null

  return (
    <Card className="todaymessages">
      <div className="card__head">
        <div>
          <h2 className="card__title">{clientsOnly ? 'Chamar hoje' : 'Mensagens de hoje'}</h2>
          <p className="card__sub">
            {items.length === 0 ? 'Nada pendente por enquanto.' : pending === 0 ? 'Tudo enviado. 💕' : `${pending} para enviar pelo seu WhatsApp`}
          </p>
        </div>
        <Link to={dash('/clientes')} className="textlink">
          Ver clientes
        </Link>
      </div>
      <ul className="people">
        {items.map((i) => {
          const sent = wasSent(i.key)
          return (
            <li key={i.key} className={`people__item ${sent ? 'is-sent' : ''}`}>
              <Avatar name={i.name} size="sm" soft />
              <div className="people__body">
                <p className="upnext__name">
                  {i.name} <span className="msgtag">{MESSAGE_LABEL[i.kind]}</span>
                </p>
                <p className="card__sub">{i.detail}</p>
              </div>
              <button
                type="button"
                className={`chevbtn ${sent ? 'is-done' : ''}`}
                aria-label={sent ? `Mensagem enviada para ${i.name}. Abrir de novo` : `Mandar mensagem para ${i.name}`}
                onClick={() => setOpen(i)}
              >
                {sent ? <Check size={14} /> : <Send size={14} />}
              </button>
            </li>
          )
        })}
      </ul>
      {open && (
        <MessageDialog
          phone={open.phone}
          kinds={open.kinds}
          initial={open.kind}
          context={{ ...open.context, ...salon }}
          onSent={() => {
            markSent(open.key)
            setTick((t) => t + 1)
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </Card>
  )
}

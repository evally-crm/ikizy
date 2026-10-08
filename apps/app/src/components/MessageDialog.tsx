import { useState } from 'react'
import { Check, Copy, MessageCircle, X } from 'lucide-react'
import { addDays, format } from 'date-fns'
import {
  APPOINTMENT_KINDS,
  MESSAGE_LABEL,
  markSent,
  renderMessage,
  sentKey,
  suggestForAppointment,
  whatsappHref,
  type MessageContext,
  type MessageKind,
} from '../lib/messages'
import { useSalonInfo } from '../hooks/useSalonInfo'
import type { Appointment } from '../types'
import { Button } from './ui'
import { Modal } from './Modal'

/** escolhe uma mensagem pronta, ajusta o texto e abre no WhatsApp da própria pessoa */
export function MessageDialog({
  phone,
  context,
  kinds,
  initial,
  onSent,
  onClose,
}: {
  phone: string
  context: MessageContext
  kinds: MessageKind[]
  initial: MessageKind
  /** chamado quando a pessoa abre o WhatsApp com a mensagem */
  onSent?: (kind: MessageKind) => void
  onClose: () => void
}) {
  const [kind, setKind] = useState<MessageKind>(initial)
  const [text, setText] = useState(() => renderMessage(initial, context))
  const [copied, setCopied] = useState(false)
  const href = whatsappHref(phone, text)

  const choose = (k: MessageKind) => {
    setKind(k)
    setText(renderMessage(k, context))
    setCopied(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Modal label={`Mensagem para ${context.clientName}`} onClose={onClose} wide>
      <div className="dialog__head">
        <div>
          <p className="eyebrow">Mensagem no WhatsApp</p>
          <h2>{context.clientName}</h2>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      <div className="form">
        <div className="chips chips--tight" role="group" aria-label="Tipo de mensagem">
          {kinds.map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => choose(k)}>
              {MESSAGE_LABEL[k]}
            </button>
          ))}
        </div>

        <label className="field">
          <span className="field__label">Texto (pode ajustar antes de enviar)</span>
          <span className="input msg__input">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={1000} />
          </span>
        </label>

        {!href && (
          <p className="msg__warn" role="status">
            {context.clientName.split(' ')[0]} está sem WhatsApp no cadastro. Copie o texto ou cadastre o número na ficha dela.
          </p>
        )}
        <p className="card__sub">
          A mensagem abre no seu WhatsApp, já escrita. É só conferir e tocar em enviar.
        </p>
      </div>

      <div className="dialog__actions">
        <Button variant="light" onClick={copy}>
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? 'Copiado' : 'Copiar texto'}
        </Button>
        {href ? (
          <a
            className="btn btn--primary"
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              onSent?.(kind)
              onClose()
            }}
          >
            <MessageCircle size={16} aria-hidden="true" /> Abrir no WhatsApp
          </a>
        ) : (
          <Button disabled>
            <MessageCircle size={16} aria-hidden="true" /> Abrir no WhatsApp
          </Button>
        )}
      </div>
    </Modal>
  )
}

/** mensagem sobre um horário da agenda, já com a sugestão certa para o momento */
export function AppointmentMessageDialog({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const { salonName, siteUrl } = useSalonInfo()
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const initial = suggestForAppointment(appointment.status, appointment.date, today, format(addDays(now, 1), 'yyyy-MM-dd'))
  return (
    <MessageDialog
      phone={appointment.phone}
      kinds={APPOINTMENT_KINDS}
      initial={initial}
      context={{
        clientName: appointment.client,
        salonName,
        siteUrl,
        service: appointment.service,
        date: appointment.date,
        start: appointment.start,
      }}
      onSent={(kind) => markSent(sentKey(kind, appointment.id, today))}
      onClose={onClose}
    />
  )
}

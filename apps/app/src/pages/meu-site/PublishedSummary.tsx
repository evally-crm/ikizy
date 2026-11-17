import { useState } from 'react'
import { Check, CircleAlert, Copy, ExternalLink } from 'lucide-react'
import { publishSummary, type SummaryInput } from '../../domain/site'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/ui'

interface Props extends SummaryInput {
  host: string
  firstTime: boolean
  onClose: () => void
  /** leva ao Perfil, onde fica a chave do agendamento online */
  onFixBooking: () => void
}

const BOOKING_TEXT = {
  online: 'A cliente pede o horário direto pela página.',
  whatsapp: 'A cliente chama você no WhatsApp.',
  none: 'A cliente não tem como falar com você.',
}

/** depois de publicar: o endereço para compartilhar, o que a cliente vai ver e o que ainda dá para melhorar */
export function PublishedSummary({ host, firstTime, onClose, onFixBooking, ...input }: Props) {
  const [copied, setCopied] = useState(false)
  const summary = publishSummary(input)
  const url = `https://${host}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* sem permissão para copiar: o endereço continua visível para copiar à mão */
    }
  }

  return (
    <Modal label="Site publicado" onClose={onClose}>
      <div className="notice">
        <span className="notice__icon notice__icon--ok" aria-hidden="true">
          <Check size={26} strokeWidth={2.4} />
        </span>
        <h2 className="notice__title">{firstTime ? 'Seu site está no ar' : 'Alterações publicadas'}</h2>
        <p className="notice__text">{host}</p>
      </div>

      <div className="psum">
        <p className="psum__label">O que sua cliente vai ver</p>
        <ul className="psum__list">
          {summary.items.map((i) => (
            <li key={i.id} className={i.ok ? 'is-ok' : 'is-todo'}>
              <span className="psum__mark" aria-hidden="true">
                {i.ok ? <Check size={13} strokeWidth={2.6} /> : <CircleAlert size={13} />}
              </span>
              <span>
                <strong>{i.label}</strong>
                <small>{i.detail}</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="psum__booking">{BOOKING_TEXT[summary.booking]}</p>
        {summary.warnings.length > 0 && (
          <div className="psum__warn" role="status">
            {summary.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
            {summary.booking !== 'online' && (
              <button type="button" className="psum__fix" onClick={onFixBooking}>
                Ligar o agendamento online
              </button>
            )}
          </div>
        )}
      </div>

      <div className="dialog__actions">
        <Button variant="light" onClick={() => void copy()}>
          <Copy size={15} aria-hidden="true" /> {copied ? 'Link copiado' : 'Copiar link'}
        </Button>
        <a className="btn btn--primary" href={url} target="_blank" rel="noreferrer" onClick={onClose}>
          Ver meu site <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>
    </Modal>
  )
}

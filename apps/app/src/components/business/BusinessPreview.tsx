import { AtSign, Clock, MapPin, MessageCircle } from 'lucide-react'
import type { OpenStatus } from '../../domain/business'
import { formatTime } from '../../lib/format'
import './BusinessPreview.css'

export interface BusinessPreviewData {
  name: string
  address: string
  whatsapp: string
  instagram: string
}

function statusText(status: OpenStatus) {
  if (status.open) return `Aberto agora, até ${formatTime(status.until)}`
  return status.opensAt !== null ? `Fechado agora, abre às ${formatTime(status.opensAt)}` : 'Fechado hoje'
}

/** como o negócio aparece para a cliente: nome, se está aberto e os contatos (acompanha o que está sendo digitado) */
export function BusinessPreview({ data, status }: { data: BusinessPreviewData; status: OpenStatus }) {
  const contact = [
    { icon: MapPin, text: data.address, empty: 'Endereço ainda não informado' },
    { icon: MessageCircle, text: data.whatsapp, empty: 'WhatsApp ainda não informado' },
    { icon: AtSign, text: data.instagram, empty: 'Instagram ainda não informado' },
  ]
  return (
    <div className="bizpreview">
      <p className="bizpreview__label">Como a cliente vê</p>
      <h3 className="bizpreview__name">{data.name || 'Nome do seu negócio'}</h3>
      <p className={`bizpreview__status ${status.open ? 'is-open' : ''}`.trim()}>
        <Clock size={14} aria-hidden="true" /> {statusText(status)}
      </p>
      <ul className="bizpreview__list">
        {contact.map(({ icon: Icon, text, empty }) => (
          <li key={empty} className={text ? '' : 'is-empty'}>
            <Icon size={16} aria-hidden="true" />
            <span>{text || empty}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

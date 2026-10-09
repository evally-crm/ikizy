import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, X } from 'lucide-react'
import { useAgenda } from '../data/AgendaProvider'
import { useSalonInfo } from '../hooks/useSalonInfo'
import { formatBRL, formatTime } from '../lib/format'
import { renderMessage, whatsappHref } from '../lib/messages'
import type { Appointment } from '../types'
import { Modal } from './Modal'
import { Avatar, Button } from './ui'

const when = (a: Appointment) => `${format(parseISO(a.date), "EEE, dd/MM", { locale: ptBR }).replace('.', '')} às ${formatTime(a.start)}`

/**
 * Confirmar ou recusar um pedido em um toque. Abre o WhatsApp da cliente com a mensagem pronta; a janela é
 * aberta antes de gravar (navegadores bloqueiam janelas abertas depois de uma espera).
 */
export function usePendingActions() {
  const { update, professionals } = useAgenda()
  const { salonName, siteUrl } = useSalonInfo()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const respond = async (a: Appointment, accept: boolean) => {
    setError(null)
    const href = whatsappHref(
      a.phone,
      renderMessage(accept ? 'aceito' : 'recusado', { clientName: a.client, salonName, siteUrl, service: a.service, date: a.date, start: a.start }),
    )
    const tab = href ? window.open('', '_blank') : null
    setBusy(a.id)
    const err = await update(a.id, { status: accept ? 'confirmado' : 'cancelado' })
    setBusy(null)
    if (err) {
      tab?.close()
      return setError(err)
    }
    if (tab && href) tab.location.href = href
  }

  const proName = (id: string) => professionals.find((p) => p.id === id)?.name
  return { respond, busy, error, proName }
}

/** lista de pedidos para confirmar (usada no aviso do topo e no Início) */
export function PendingList({ items, limit }: { items: Appointment[]; limit?: number }) {
  const { respond, busy, error, proName } = usePendingActions()
  const shown = limit ? items.slice(0, limit) : items

  return (
    <>
      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}
      <ul className="pending">
        {shown.map((a) => (
          <li key={a.id} className="pending__item">
            <Avatar name={a.client} size="sm" soft />
            <div className="pending__who">
              <p className="pending__name">{a.client}</p>
              <p className="pending__meta">
                {a.service} · {when(a)}
                {proName(a.professionalId) ? ` · ${proName(a.professionalId)}` : ''}
                {a.price > 0 ? ` · ${formatBRL(a.price)}` : ''}
              </p>
            </div>
            <div className="pending__actions">
              <Button size="sm" disabled={busy === a.id} onClick={() => void respond(a, true)} aria-label={`Confirmar pedido de ${a.client}`}>
                <Check size={14} aria-hidden="true" /> Confirmar
              </Button>
              <Button variant="light" size="sm" disabled={busy === a.id} onClick={() => void respond(a, false)} aria-label={`Recusar pedido de ${a.client}`}>
                <X size={14} aria-hidden="true" /> Recusar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/** janela com todos os pedidos (aberta pelo sininho) */
export function PendingDialog({ onClose }: { onClose: () => void }) {
  const { pending } = useAgenda()
  return (
    <Modal label="Pedidos para confirmar" onClose={onClose}>
      <div className="dialog__head">
        <h2>Pedidos para confirmar</h2>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      {pending.length === 0 ? (
        <p className="card__sub">Nenhum pedido esperando. Quando uma cliente agendar pelo seu site, ele aparece aqui.</p>
      ) : (
        <>
          <p className="card__sub">
            Ao confirmar ou recusar, o WhatsApp da cliente abre com a mensagem pronta. É só tocar em enviar.
          </p>
          <PendingList items={pending} />
        </>
      )}
    </Modal>
  )
}

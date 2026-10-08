import { useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeft, Check, Copy, MessageCircle, X } from 'lucide-react'
import { CLIENT_KINDS, MESSAGE_LABEL, markSent, renderMessage, sentKey, whatsappHref, type MessageKind } from '../lib/messages'
import { useSalonInfo } from '../hooks/useSalonInfo'
import type { Client } from '../data/clients'
import { formatPhone } from '../lib/format'
import { Avatar, Button } from './ui'
import { Modal } from './Modal'

const NAME = '{nome}'
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

/**
 * Disparo para várias clientes sem API: a mensagem é escrita uma vez e cada envio abre o WhatsApp
 * da própria pessoa já com o texto (e o nome) de cada uma. É um toque por cliente, sem risco de bloqueio.
 */
export function BulkMessageDialog({
  clients,
  onClose,
}: {
  clients: Client[]
  onClose: () => void
}) {
  const { salonName, siteUrl } = useSalonInfo()
  const render = (k: MessageKind) => renderMessage(k, { clientName: NAME, salonName, siteUrl })
  const [step, setStep] = useState<'texto' | 'envio'>('texto')
  const [kind, setKind] = useState<MessageKind>('livre')
  const [text, setText] = useState(() => render('livre'))
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [today] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const choose = (k: MessageKind) => {
    setKind(k)
    setText(render(k))
  }
  const textFor = (c: Client) => text.split(NAME).join(firstName(c.name))
  const withPhone = clients.filter((c) => whatsappHref(c.phone, '.'))
  const done = withPhone.filter((c) => sent.has(c.id)).length
  const next = withPhone.find((c) => !sent.has(c.id))

  const send = (c: Client) => {
    setSent((s) => new Set(s).add(c.id))
    markSent(sentKey(kind, c.id, today))
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.split(NAME).join('').replace(/,\s*!/g, '!'))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Modal label="Mensagem para várias clientes" onClose={onClose} wide>
      <div className="dialog__head">
        <div>
          <p className="eyebrow">Mensagem no WhatsApp</p>
          <h2>
            {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}
          </h2>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      {step === 'texto' ? (
        <>
          <div className="form">
            <div className="chips chips--tight" role="group" aria-label="Tipo de mensagem">
              {CLIENT_KINDS.map((k) => (
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
            <p className="card__sub">
              Onde estiver <strong>{NAME}</strong> entra o primeiro nome de cada cliente.
            </p>
            {withPhone.length < clients.length && (
              <p className="msg__warn" role="status">
                {clients.length - withPhone.length} {clients.length - withPhone.length === 1 ? 'cliente está' : 'clientes estão'} sem
                WhatsApp no cadastro e {clients.length - withPhone.length === 1 ? 'fica' : 'ficam'} de fora.
              </p>
            )}
          </div>

          <div className="dialog__actions">
            <Button variant="light" onClick={copy}>
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? 'Copiado' : 'Copiar texto'}
            </Button>
            <Button disabled={!withPhone.length || !text.trim()} onClick={() => setStep('envio')}>
              <MessageCircle size={16} aria-hidden="true" /> Continuar
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="form">
            <p className="card__sub">
              Toque em <strong>Enviar</strong> em cada uma: o WhatsApp abre com a mensagem pronta, você envia e volta aqui para a
              próxima. {done} de {withPhone.length} {done === 1 ? 'enviada' : 'enviadas'}.
            </p>
            <ul className="bulk__list">
              {withPhone.map((c) => {
                const ok = sent.has(c.id)
                return (
                  <li key={c.id} className={`bulk__item ${ok ? 'is-sent' : ''}`}>
                    <Avatar name={c.name} soft />
                    <span className="clist__body">
                      <span className="clist__name">{c.name}</span>
                      <span className="clist__meta">{formatPhone(c.phone)}</span>
                    </span>
                    <a
                      className={`btn btn--sm ${ok ? 'btn--light' : 'btn--primary'}`}
                      href={whatsappHref(c.phone, textFor(c)) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => send(c)}
                    >
                      {ok ? <Check size={14} aria-hidden="true" /> : <MessageCircle size={14} aria-hidden="true" />} {ok ? 'Enviada' : 'Enviar'}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="dialog__actions">
            <Button variant="light" onClick={() => setStep('texto')}>
              <ArrowLeft size={16} aria-hidden="true" /> Texto
            </Button>
            {next ? (
              <a className="btn btn--primary" href={whatsappHref(next.phone, textFor(next)) ?? undefined} target="_blank" rel="noreferrer" onClick={() => send(next)}>
                <MessageCircle size={16} aria-hidden="true" /> Enviar para {firstName(next.name)}
              </a>
            ) : (
              <Button onClick={onClose}>
                <Check size={16} aria-hidden="true" /> Concluir
              </Button>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}

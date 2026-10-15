import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Check, MessageCircle } from 'lucide-react'
import type { Client } from '../../data/clients'
import {
  FILTERS,
  TAG_LABEL,
  awaitsConfirmation,
  callReason,
  callReasonLabel,
  clientTags,
  countToCall,
  daysSince,
  filterClients,
  lastVisitLabel,
  type CallReason,
  type ClientFilter,
} from '../../domain/clients'
import { BulkMessageDialog } from '../../components/BulkMessageDialog'
import { MessageDialog } from '../../components/MessageDialog'
import { useSalonInfo } from '../../hooks/useSalonInfo'
import { CLIENT_KINDS, markSent, sentKey, wasSent } from '../../lib/messages'
import { Avatar, Button, Card, SearchField, Tabs, Tag, Tags } from '../../components/ui'
import { formatBRL, formatPhone } from '../../lib/format'
import { dash } from '../../lib/routes'
import './Clientes.css'

/**
 * lista de contatos: busca, filtro por marcação, "Chamar hoje" com a mensagem pronta de cada uma e,
 * quando pedido, seleção de várias para mandar a mesma mensagem
 */
export function ClientList({ clients, selectedId, today }: { clients: Client[]; selectedId?: string; today: Date }) {
  const [query, setQuery] = useState('')
  // ?filtro=chamar (atalho da Início) abre já no filtro pedido
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<ClientFilter>(() => FILTERS.find((f) => f.id === params.get('filtro'))?.id ?? 'todas')
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState(false)
  const [calling, setCalling] = useState<{ client: Client; reason: CallReason } | null>(null)
  const [, setSentTick] = useState(0)
  const salonInfo = useSalonInfo()
  const dayKey = format(today, 'yyyy-MM-dd')

  const visible = useMemo(() => filterClients(clients, query, filter, today), [clients, query, filter, today])
  const toCall = useMemo(() => countToCall(clients, today), [clients, today])
  const allPicked = visible.length > 0 && visible.every((c) => picked.has(c.id))
  // o número de cada filtro fica num selo ao lado do nome, no lugar dos números grandes
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, f.id === 'chamar' ? toCall : filterClients(clients, '', f.id, today).length])) as Record<ClientFilter, number>,
    [clients, today, toCall],
  )
  const filterItems = FILTERS.map((f) => ({ id: f.id, label: f.label, badge: counts[f.id] > 0 ? counts[f.id] : undefined }))

  const stopPicking = () => {
    setPicking(false)
    setPicked(new Set())
  }

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setPicked((p) => {
      const next = new Set(p)
      for (const c of visible) {
        if (allPicked) next.delete(c.id)
        else next.add(c.id)
      }
      return next
    })

  return (
    <Card className="crm__list">
      <SearchField value={query} onChange={setQuery} label="Buscar cliente" placeholder="Buscar por nome ou telefone" />

      <div className="crm__filters">
        <Tabs label="Filtrar clientes" value={filter} onChange={setFilter} items={filterItems} />
      </div>

      {picking ? (
        <div className="crm__pickbar">
          <span>
            {picked.size} {picked.size === 1 ? 'selecionada' : 'selecionadas'}
          </span>
          {visible.length > 0 && (
            <button type="button" className="textlink" onClick={toggleAll}>
              {allPicked ? 'Desmarcar todas' : `Todas (${visible.length})`}
            </button>
          )}
          <button type="button" className="textlink" onClick={stopPicking}>
            Cancelar
          </button>
          <Button size="sm" disabled={picked.size === 0} onClick={() => setBulk(true)}>
            <MessageCircle size={14} aria-hidden="true" /> Enviar
          </Button>
        </div>
      ) : (
        <div className="crm__countbar">
          <p className="crm__count">
            {visible.length} {visible.length === 1 ? 'contato' : 'contatos'}
            {filter === 'chamar' && visible.length > 0 ? ' para chamar hoje' : ''}
          </p>
          {visible.length > 1 && (
            <button type="button" className="textlink" onClick={() => setPicking(true)}>
              Selecionar várias
            </button>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="crm__empty">Nenhuma cliente encontrada.</p>
      ) : (
        <ul className="clist">
          {visible.map((c) => {
            const on = picked.has(c.id)
            const tags = clientTags(c, today)
            const waiting = awaitsConfirmation(c, today)
            const reason = filter === 'chamar' ? callReason(c, today) : null
            const sent = reason ? wasSent(sentKey(reason.kind, c.id, dayKey)) : false
            return (
              <li key={c.id} className="clist__row">
                {picking && (
                  <button
                    type="button"
                    className={`selbtn ${on ? 'is-on' : ''}`.trim()}
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`Selecionar ${c.name}`}
                    onClick={() => toggle(c.id)}
                  >
                    {on && <Check size={14} aria-hidden="true" />}
                  </button>
                )}
                <Link
                  to={dash(`/clientes/${c.id}`)}
                  className={`clist__item ${c.id === selectedId ? 'is-active' : ''}`.trim()}
                  aria-current={c.id === selectedId ? 'page' : undefined}
                >
                  <Avatar name={c.name} soft={c.id !== selectedId} />
                  <span className="clist__body">
                    <span className="clist__name">{c.name}</span>
                    <span className="clist__phone">{c.phone ? formatPhone(c.phone) : 'Sem WhatsApp'}</span>
                    <span className={`clist__meta ${reason ? 'clist__meta--call' : ''}`.trim()}>
                      {reason
                        ? callReasonLabel(reason)
                        : c.visits === 0
                        ? 'Ainda sem visitas'
                        : `${lastVisitLabel(daysSince(c.lastVisit, today))} · ${c.visits} ${c.visits === 1 ? 'visita' : 'visitas'}`}
                    </span>
                    {(tags.length > 0 || waiting) && (
                      <Tags>
                        {waiting && <Tag tone="aconfirmar">A confirmar</Tag>}
                        {tags.map((t) => (
                          <Tag key={t} tone={t}>
                            {TAG_LABEL[t]}
                          </Tag>
                        ))}
                      </Tags>
                    )}
                  </span>
                  {!reason && <span className="clist__spent">{formatBRL(c.totalSpent).replace(',00', '')}</span>}
                </Link>
                {reason && !picking && (
                  <button
                    type="button"
                    className={`clist__call ${sent ? 'is-sent' : ''}`.trim()}
                    aria-label={sent ? `Mensagem já enviada para ${c.name}; enviar de novo` : `Mandar mensagem para ${c.name}`}
                    onClick={() => setCalling({ client: c, reason })}
                  >
                    {sent ? <Check size={16} aria-hidden="true" /> : <MessageCircle size={16} aria-hidden="true" />}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {bulk && <BulkMessageDialog clients={clients.filter((c) => picked.has(c.id))} onClose={() => setBulk(false)} />}
      {calling && (
        <MessageDialog
          phone={calling.client.phone}
          kinds={CLIENT_KINDS}
          initial={calling.reason.kind}
          context={{ clientName: calling.client.name, ...salonInfo }}
          onSent={(kind) => {
            markSent(sentKey(kind, calling.client.id, dayKey))
            setSentTick((t) => t + 1)
          }}
          onClose={() => setCalling(null)}
        />
      )}
    </Card>
  )
}

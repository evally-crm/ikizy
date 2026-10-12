import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MessageCircle } from 'lucide-react'
import type { Client } from '../../data/clients'
import { FILTERS, TAG_LABEL, awaitsConfirmation, clientTags, daysSince, filterClients, lastVisitLabel, type ClientFilter } from '../../domain/clients'
import { BulkMessageDialog } from '../../components/BulkMessageDialog'
import { Avatar, Button, Card, SearchField, Tabs, Tag, Tags } from '../../components/ui'
import { formatBRL, formatPhone } from '../../lib/format'
import { dash } from '../../lib/routes'
import './Clientes.css'

/** lista de contatos: busca, filtro por marcação e seleção de várias para mandar a mesma mensagem */
export function ClientList({ clients, selectedId, today }: { clients: Client[]; selectedId?: string; today: Date }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ClientFilter>('todas')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState(false)

  const visible = useMemo(() => filterClients(clients, query, filter, today), [clients, query, filter, today])
  const allPicked = visible.length > 0 && visible.every((c) => picked.has(c.id))

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
        <Tabs label="Filtrar clientes" value={filter} onChange={setFilter} items={FILTERS.map((f) => ({ id: f.id, label: f.label }))} />
      </div>

      {picked.size > 0 ? (
        <div className="crm__pickbar">
          <span>
            {picked.size} {picked.size === 1 ? 'selecionada' : 'selecionadas'}
          </span>
          <button type="button" className="textlink" onClick={() => setPicked(new Set())}>
            Limpar
          </button>
          <Button size="sm" onClick={() => setBulk(true)}>
            <MessageCircle size={14} aria-hidden="true" /> Enviar mensagem
          </Button>
        </div>
      ) : (
        <p className="crm__count">
          {visible.length} {visible.length === 1 ? 'contato' : 'contatos'} · marque a bolinha para enviar para várias
        </p>
      )}
      {visible.length > 0 && (
        <button type="button" className="textlink crm__pickall" onClick={toggleAll}>
          {allPicked ? 'Desmarcar todas' : `Selecionar todas (${visible.length})`}
        </button>
      )}

      {visible.length === 0 ? (
        <p className="crm__empty">Nenhuma cliente encontrada.</p>
      ) : (
        <ul className="clist">
          {visible.map((c) => {
            const on = picked.has(c.id)
            const tags = clientTags(c, today)
            const waiting = awaitsConfirmation(c, today)
            return (
              <li key={c.id} className="clist__row">
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
                <Link
                  to={dash(`/clientes/${c.id}`)}
                  className={`clist__item ${c.id === selectedId ? 'is-active' : ''}`.trim()}
                  aria-current={c.id === selectedId ? 'page' : undefined}
                >
                  <Avatar name={c.name} soft={c.id !== selectedId} />
                  <span className="clist__body">
                    <span className="clist__name">{c.name}</span>
                    <span className="clist__phone">{c.phone ? formatPhone(c.phone) : 'Sem WhatsApp'}</span>
                    <span className="clist__meta">
                      {c.visits === 0
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
                  <span className="clist__spent">{formatBRL(c.totalSpent).replace(',00', '')}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {bulk && <BulkMessageDialog clients={clients.filter((c) => picked.has(c.id))} onClose={() => setBulk(false)} />}
    </Card>
  )
}

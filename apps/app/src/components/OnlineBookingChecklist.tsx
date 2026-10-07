import { Link } from 'react-router-dom'
import { Check, Circle, Clock } from 'lucide-react'
import { useAgenda } from '../data/AgendaProvider'
import { dash } from '../lib/routes'
import { Card } from './ui'

type State = 'ok' | 'todo' | 'soon'

interface Item {
  id: string
  title: string
  detail: string
  state: State
  /** onde resolver, quando já existe tela para isso */
  action?: { to: string; label: string }
}

/**
 * O que o salão precisa ter pronto antes de abrir o agendamento online.
 * Enquanto algum item estiver pendente, a página pública não mostra o botão de agendar.
 */
export default function OnlineBookingChecklist({ whatsapp }: { whatsapp: string }) {
  const { professionals, services, workingHours, hoursAvailable } = useAgenda()

  const priced = services.filter((s) => s.price > 0 && s.duration > 0)
  const withHours = professionals.filter((p) => (workingHours[p.id]?.length ?? 0) > 0)

  const items: Item[] = [
    {
      id: 'services',
      title: 'Serviços com preço e duração',
      detail:
        services.length === 0
          ? 'Nenhum serviço cadastrado.'
          : priced.length === 0
            ? 'Nenhum serviço com preço definido.'
            : `${priced.length} de ${services.length} serviços prontos.`,
      state: priced.length > 0 ? 'ok' : 'todo',
    },
    {
      id: 'team',
      title: 'Quem atende',
      detail: professionals.length === 0 ? 'Cadastre ao menos uma profissional na agenda.' : `${professionals.length} profissional(is) ativa(s).`,
      state: professionals.length > 0 ? 'ok' : 'todo',
      action: professionals.length === 0 ? { to: dash('/agenda'), label: 'Abrir agenda' } : undefined,
    },
    {
      id: 'hours',
      title: 'Horário de atendimento',
      detail: !hoursAvailable
        ? 'Recurso ainda não ativado neste ambiente (falta aplicar a atualização do banco).'
        : professionals.length === 0
          ? 'Depende de ter uma profissional cadastrada.'
          : withHours.length === professionals.length
            ? 'Todas as profissionais têm horário definido.'
            : `${withHours.length} de ${professionals.length} profissionais com horário definido.`,
      state: professionals.length > 0 && hoursAvailable && withHours.length === professionals.length ? 'ok' : 'todo',
      action: professionals.length > 0 && hoursAvailable ? { to: `${dash('/agenda')}?horarios=1`, label: 'Definir horários' } : undefined,
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp do salão',
      detail: whatsapp.trim() ? 'É por ele que o cliente fala com você e você responde aos pedidos.' : 'Preencha o WhatsApp aqui na aba Página.',
      state: whatsapp.trim() ? 'ok' : 'todo',
    },
    {
      id: 'rules',
      title: 'Regras do agendamento',
      detail: 'Antecedência mínima, até quando marcar e prazo para você responder. Chega na próxima etapa.',
      state: 'soon',
    },
  ]

  const required = items.filter((i) => i.state !== 'soon')
  const missing = required.filter((i) => i.state === 'todo').length

  return (
    <Card className="checklist">
      <div className="checklist__head">
        <div>
          <h3 className="checklist__title">Agendamento pelo site</h3>
          <p className="card__sub">
            {missing === 0
              ? 'Tudo pronto. O botão de agendar aparece na sua página quando essa etapa for ativada.'
              : `Faltam ${missing} ${missing === 1 ? 'item' : 'itens'} para o cliente poder pedir horário.`}
          </p>
        </div>
        <span className={`checklist__badge ${missing === 0 ? 'is-ready' : ''}`}>
          {required.length - missing}/{required.length}
        </span>
      </div>

      <ol className="checklist__list">
        {items.map((it) => (
          <li key={it.id} className={`checklist__item is-${it.state}`}>
            <span className="checklist__icon" aria-hidden="true">
              {it.state === 'ok' ? <Check size={14} /> : it.state === 'soon' ? <Clock size={13} /> : <Circle size={10} />}
            </span>
            <div className="checklist__text">
              <p>{it.title}</p>
              <small>{it.detail}</small>
            </div>
            {it.action && it.state !== 'ok' && (
              <Link className="textlink" to={it.action.to}>
                {it.action.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}

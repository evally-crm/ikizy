import { CalendarCheck, AtSign, Clock, MessageCircle } from 'lucide-react'
import { ACCENTS, CATEGORIES, type Studio } from '../data/catalog'
import { professionals } from '../data/mock'
import { formatBRL } from '../lib/format'

/** prévia ao vivo da página pública do salão */
export default function SitePreview({ studio }: { studio: Studio }) {
  const { site, services } = studio
  const accent = ACCENTS[site.accent]
  const visible = services.filter((s) => s.visible && s.name.trim())
  const groups = CATEGORIES.map((c) => ({ category: c, items: visible.filter((s) => s.category === c) })).filter(
    (g) => g.items.length,
  )
  const lead = site.tagline.trim() || 'Seu cuidado começa aqui.'
  const lastSpace = lead.lastIndexOf(' ')
  const head = lastSpace > 0 ? lead.slice(0, lastSpace) : ''
  const tail = lastSpace > 0 ? lead.slice(lastSpace + 1) : lead

  return (
    <div
      className="sp"
      style={{ ['--sp-accent' as string]: accent.color, ['--sp-soft' as string]: accent.soft }}
    >
      <header className="sp__nav">
        <span className="sp__logo">{site.salonName || 'Seu salão'}</span>
        <span className="sp__navlinks">
          <span>Serviços</span>
          <span>Sobre</span>
        </span>
      </header>

      <section className="sp__hero">
        <p className="sp__eyebrow">Designed for Beauty</p>
        <h3 className="sp__title">
          {head} <em>{tail}</em>
        </h3>
        <p className="sp__text">{site.about}</p>
        <span className="sp__cta">
          <CalendarCheck size={14} aria-hidden="true" /> Agendar agora
        </span>
        {site.depositPercent > 0 && (
          <p className="sp__note">Sinal de {site.depositPercent}% via Pix para garantir o horário.</p>
        )}
      </section>

      <section className="sp__section">
        <p className="sp__eyebrow">Nossos serviços</p>
        {groups.length === 0 && <p className="sp__text">Nenhum serviço visível ainda.</p>}
        {groups.map((g) => (
          <div key={g.category} className="sp__group">
            <h4>{g.category}</h4>
            <ul>
              {g.items.map((s) => (
                <li key={s.id}>
                  <span className="sp__svc">
                    {s.name}
                    <small>{s.duration} min</small>
                  </span>
                  {site.showPrices && <span className="sp__price">{formatBRL(s.price).replace(',00', '')}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {site.showTeam && (
        <section className="sp__section">
          <p className="sp__eyebrow">Quem cuida de você</p>
          <ul className="sp__team">
            {professionals.map((p) => (
              <li key={p.id}>
                <span className="sp__avatar">{p.name[0]}</span>
                <span>
                  {p.name}
                  <small>{p.role}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="sp__foot">
        <p>
          <Clock size={13} aria-hidden="true" /> {site.hours}
        </p>
        {site.whatsapp && (
          <p>
            <MessageCircle size={13} aria-hidden="true" /> {site.whatsapp}
          </p>
        )}
        {site.instagram && (
          <p>
            <AtSign size={13} aria-hidden="true" /> {site.instagram}
          </p>
        )}
        <small>evally.app/{site.slug || 'seu-salao'}</small>
      </footer>
    </div>
  )
}

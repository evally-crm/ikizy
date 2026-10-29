import { useMemo, type CSSProperties } from 'react'
import type { OnboardingDraft } from '../../data/onboarding'
import { previewWeek, reviewGroups, type PreviewWeek } from '../../domain/onboarding'
import { formatTime } from '../../lib/format'
import { siteHost } from '../../lib/slug'
import './AppPreview.css'
import { LogoWord } from '../../components/BunnyMark'

export type PreviewPhase = 'blank' | 'building' | 'ready'

const NAV = ['Agenda', 'Clientes', 'Financeiro', 'Meu site', 'Negócio']

/**
 * O sistema "se montando" atrás da pergunta: barra do topo, a semana da agenda e o site do negócio.
 * O que a pessoa responde aparece aqui na hora (nome, link, dias abertos, serviços, equipe);
 * o resto fica em cinza, como esqueleto. Só desenho: nada aqui é clicável.
 */
export function AppPreview({
  name,
  slug,
  ownerName,
  team,
  week,
  services,
  phase,
}: {
  name: string
  slug: string
  ownerName: string
  team: 'solo' | 'equipe' | null
  week: PreviewWeek
  services: string[]
  phase: PreviewPhase
}) {
  const initial = (ownerName.trim()[0] ?? '').toUpperCase()
  return (
    <div className={`apv apv--${phase}`}>
      <div className="apv__top">
        <span className="apv__logo">
          <LogoWord />
        </span>
        <nav className="apv__nav">
          {NAV.map((label, i) => (
            <span key={label} className={i === 0 ? 'apv__tab apv__tab--on' : 'apv__tab'}>
              {label}
            </span>
          ))}
        </nav>
        <span className="apv__me">
          {name ? <span className="apv__salon">{name}</span> : <span className="apv__bone apv__bone--md" />}
          <span className="apv__avatar">{initial}</span>
        </span>
      </div>

      <div className="apv__body">
        <section className="apv__agenda">
          <div className="apv__head">
            <span className="apv__h">Agenda</span>
            <span className="apv__team">
              <span className="apv__avatar apv__avatar--sm">{initial}</span>
              {team === 'equipe' && (
                <>
                  <span className="apv__avatar apv__avatar--sm apv__avatar--ghost" />
                  <span className="apv__avatar apv__avatar--sm apv__avatar--ghost" />
                </>
              )}
            </span>
          </div>
          <div className="apv__grid">
            <div className="apv__hours">
              {week.hours.map((m) => (
                <span key={m}>{formatTime(m)}</span>
              ))}
            </div>
            {week.days.map((d) => (
              <div key={d.weekday} className={d.open ? 'apv__day apv__day--open' : 'apv__day'}>
                <span className="apv__dlabel">{d.label}</span>
                <div className="apv__col">
                  {d.open && <span className="apv__range" style={{ '--top': `${d.openTop}%`, '--h': `${d.openHeight}%` } as CSSProperties} />}
                  {d.blocks.map((b, i) => (
                    <span
                      key={i}
                      className="apv__appt"
                      style={{ '--top': `${b.top}%`, '--h': `${b.height}%`, '--i': i } as CSSProperties}
                    >
                      {b.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="apv__site">
          <span className="apv__url">{slug ? siteHost(slug) : <span className="apv__bone apv__bone--md" />}</span>
          <div className="apv__cover">{name ? <b>{name}</b> : <span className="apv__bone apv__bone--lg" />}</div>
          <span className="apv__sh">Serviços</span>
          <ul className="apv__services">
            {services.length > 0
              ? services.slice(0, 7).map((s) => (
                  <li key={s}>
                    <span>{s}</span>
                    <span className="apv__btn">Agendar</span>
                  </li>
                ))
              : [0, 1, 2, 3].map((i) => (
                  <li key={i}>
                    <span className="apv__bone apv__bone--md" />
                    <span className="apv__bone apv__bone--sm" />
                  </li>
                ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

/** a prévia montada direto do rascunho do cadastro */
export function DraftPreview({ draft, ownerName, phase }: { draft: OnboardingDraft; ownerName: string; phase: PreviewPhase }) {
  const services = useMemo(
    () => reviewGroups(draft.segments, draft.otherLabel, draft.removed, draft.added).flatMap((g) => g.services),
    [draft.segments, draft.otherLabel, draft.removed, draft.added],
  )
  const week = useMemo(
    () => previewWeek(draft.days, draft.start, draft.end, services, phase === 'ready'),
    [draft.days, draft.start, draft.end, services, phase],
  )
  return (
    <AppPreview
      name={draft.name.trim()}
      slug={draft.slug}
      ownerName={ownerName}
      team={draft.team}
      week={week}
      services={services.map((s) => s.name)}
      phase={phase}
    />
  )
}

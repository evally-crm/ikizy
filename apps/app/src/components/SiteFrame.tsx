import { useEffect, useMemo, useRef, useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { renderSitePage, type PublicSite } from '../../api/_lib/siteHtml.ts'
import type { Studio } from '../data/catalog'
import { useAgenda } from '../data/AgendaProvider'

export type Device = 'mobile' | 'desktop'

const WIDTH: Record<Device, number> = { mobile: 390, desktop: 1200 }

/** o que a página pública vai mostrar, montado a partir do rascunho (a prévia usa o mesmo gerador da página real) */
function toPublicSite(studio: Studio, team: { name: string; role: string }[]): PublicSite {
  const { site, services } = studio
  return {
    name: site.salonName.trim() || 'Seu salão',
    slug: site.slug,
    settings: {
      tagline: site.tagline,
      about: site.about,
      whatsapp: site.whatsapp,
      instagram: site.instagram,
      hours: site.hours,
      address: site.address,
      accent: site.accent,
      accent_color: site.accentColor || null,
      logo: site.logo || null,
      cover: site.cover || null,
      theme: site.theme,
      font: site.font,
      show_prices: site.showPrices,
      show_team: site.showTeam,
      // na prévia o agendamento não roda (não há script), então não mostramos o botão da janela
      online_booking: false,
    },
    services: services
      .filter((s) => s.visible && s.name.trim())
      .map((s) => ({ name: s.name, category: s.category, duration: s.duration, price: site.showPrices ? s.price : null })),
    plans: [],
    team: site.showTeam ? team.map((p) => ({ name: p.name, title: p.role })) : [],
  }
}

export function DeviceToggle({ device, onChange }: { device: Device; onChange: (d: Device) => void }) {
  return (
    <div className="devtoggle" role="group" aria-label="Tamanho da prévia">
      <button type="button" aria-pressed={device === 'desktop'} onClick={() => onChange('desktop')}>
        <Monitor size={15} aria-hidden="true" /> Computador
      </button>
      <button type="button" aria-pressed={device === 'mobile'} onClick={() => onChange('mobile')}>
        <Smartphone size={15} aria-hidden="true" /> Celular
      </button>
    </div>
  )
}

/** prévia fiel da página pública, dentro de um quadro que encolhe para caber no espaço disponível */
export default function SiteFrame({ studio, device, height = 560 }: { studio: Studio; device: Device; height?: number }) {
  const { professionals } = useAgenda()
  const html = useMemo(() => renderSitePage(toPublicSite(studio, professionals), { canonical: '#' }), [studio, professionals])

  const box = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(0)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setAvail(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const width = WIDTH[device]
  const scale = avail > 0 ? Math.min(1, avail / width) : 1
  const shownWidth = Math.round(width * scale)

  return (
    <div ref={box} className={`siteframe siteframe--${device}`} style={{ height }}>
      <div className="siteframe__chrome" style={{ width: shownWidth, height }}>
        <iframe
          title="Prévia do seu site"
          srcDoc={html}
          sandbox=""
          style={{ width, height: height / scale, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
      </div>
    </div>
  )
}

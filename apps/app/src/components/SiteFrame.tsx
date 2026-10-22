import './SiteFrame.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { renderSitePage, type PublicSite } from '../../api/_lib/siteHtml.ts'
import { brandUrl, photoUrl, type Studio } from '../data/catalog'
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
      palette: site.palette,
      logo: brandUrl(site.logo) || null,
      cover: brandUrl(site.cover) || null,
      font: site.font,
      cover_style: site.coverStyle,
      show_prices: site.showPrices,
      show_team: site.showTeam,
      // na prévia o agendamento não roda (não há script), então não mostramos o botão da janela
      online_booking: false,
    },
    services: services
      .filter((s) => s.visible && s.name.trim())
      .map((s) => ({ name: s.name, category: s.category, duration: s.duration, price: site.showPrices ? s.price : null, photo: photoUrl(s) || null })),
    showcase: studio.showcase
      .filter((x) => x.visible && x.name.trim())
      .map((x) => ({ name: x.name, description: x.description, price: site.showPrices ? x.price : null, photo: photoUrl(x) || null })),
    plans: studio.plans
      .filter((x) => x.visible && x.name.trim())
      .map((x) => ({
        name: x.name,
        description: x.description,
        includes: x.includes.map((i) => i.trim()).filter(Boolean),
        is_new: x.isNew,
        price: site.showPrices ? x.price : null,
      })),
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
const BAR = 38

/** prévia fiel da página pública, numa moldura de navegador que encolhe para caber no espaço disponível */
export default function SiteFrame({
  studio,
  device,
  height = 560,
}: {
  studio: Studio
  device: Device
  height?: number | 'fill'
}) {
  const { professionals } = useAgenda()
  const html = useMemo(() => renderSitePage(toPublicSite(studio, professionals), { canonical: '#' }), [studio, professionals])

  const box = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(0)
  const [availH, setAvailH] = useState(0)
  const fill = height === 'fill'
  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => {
      setAvail(el.clientWidth)
      setAvailH(el.clientHeight)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const h = fill ? Math.max(240, availH) : height
  const width = WIDTH[device]
  const scale = avail > 0 ? Math.min(1, avail / width) : 1
  const shownWidth = Math.round(width * scale)
  const viewH = h - BAR
  const host = `${studio.site.slug || 'seu-salao'}.ikizy.com`

  return (
    <div ref={box} className={`siteframe siteframe--${device} ${fill ? 'siteframe--fill' : ''}`} style={fill ? undefined : { height }}>
      <div className="siteframe__chrome" style={{ width: shownWidth, height: h }}>
        <div className="siteframe__bar" aria-hidden="true">
          {device === 'desktop' && (
            <span className="siteframe__dots">
              <i />
              <i />
              <i />
            </span>
          )}
          <span className="siteframe__url">{host}</span>
        </div>
        <iframe
          title="Prévia do seu site"
          srcDoc={html}
          sandbox=""
          style={{ width, height: viewH / scale, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
      </div>
    </div>
  )
}

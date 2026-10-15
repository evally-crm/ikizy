import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { PALETTES, type PaletteId, type SiteConfig } from '../../data/catalog'
import { COVER_STYLES, FONTS, type CoverStyleId, type FontId } from '../../lib/siteTheme'
import { Group } from './Group'
import type { SetSite } from './types'
import './MeuSite.css'

const paletteVars = (id: PaletteId) => ({ '--bg': PALETTES[id].bg, '--accent': PALETTES[id].accent }) as CSSProperties
const fontVars = (id: FontId) =>
  ({ '--ff': FONTS[id].family, '--fw': FONTS[id].weight, '--tt': FONTS[id].upper ? 'uppercase' : 'none' }) as CSSProperties

/** paleta de cores (duas cores por opção) */
export function PaletteOptions({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  return (
    <div className="palettes">
      {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
        <label key={id} className="palette">
          <input type="radio" name="palette" checked={site.palette === id} onChange={() => setSite('palette', id)} />
          <span className="palette__dot" style={paletteVars(id)} aria-hidden="true">
            <Check className="palette__check" size={20} strokeWidth={2.5} />
          </span>
          {PALETTES[id].label}
        </label>
      ))}
    </div>
  )
}

/** estilo da capa: o que fica atrás do título; a miniatura usa as cores da paleta escolhida */
export function CoverStyleOptions({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  return (
    <div className="coverpick" style={paletteVars(site.palette)}>
      {(Object.keys(COVER_STYLES) as CoverStyleId[]).map((id) => (
        <label key={id} className="coverpick__opt">
          <input type="radio" name="coverStyle" checked={site.coverStyle === id} onChange={() => setSite('coverStyle', id)} />
          <span className={`coverpick__tile coverpick__tile--${id}`} aria-hidden="true">
            <span className="coverpick__check">
              <Check size={14} strokeWidth={2.75} />
            </span>
          </span>
          <strong>{COVER_STYLES[id].label}</strong>
          <small>{COVER_STYLES[id].hint}</small>
        </label>
      ))}
    </div>
  )
}

/** fonte dos títulos: blocos "Aa" escritos na própria fonte, com o nome embaixo */
export function FontOptions({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  return (
    <div className="fontpick">
      {(Object.keys(FONTS) as FontId[]).map((id) => (
        <label key={id} className="fontpick__opt">
          <input type="radio" name="font" checked={site.font === id} onChange={() => setSite('font', id)} />
          <span className="fontpick__aa swatch__font" style={fontVars(id)} aria-hidden="true">
            Aa
          </span>
          <span className="fontpick__name">{FONTS[id].sample}</span>
          <small>{FONTS[id].label}</small>
        </label>
      ))}
    </div>
  )
}

/** aparência: paleta, estilo da capa e fonte */
export function AppearanceFields({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  return (
    <>
      <Group title="Paleta de cores">
        <fieldset className="field">
          <legend className="sr-only">Paleta de cores</legend>
          <PaletteOptions site={site} setSite={setSite} />
        </fieldset>
      </Group>
      <Group title="Estilo da capa">
        <fieldset className="field">
          <legend className="sr-only">Estilo da capa</legend>
          <CoverStyleOptions site={site} setSite={setSite} />
          <p className="field__hint">Vale quando a capa não tem foto. Se você enviar uma foto, ela passa na frente.</p>
        </fieldset>
      </Group>
      <Group title="Fonte dos títulos">
        <fieldset className="field">
          <legend className="sr-only">Fonte dos títulos</legend>
          <FontOptions site={site} setSite={setSite} />
        </fieldset>
      </Group>
    </>
  )
}

export { fontVars, paletteVars }

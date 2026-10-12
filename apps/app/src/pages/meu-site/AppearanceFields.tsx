import type { CSSProperties } from 'react'
import { PALETTES, type PaletteId, type SiteConfig } from '../../data/catalog'
import { FONTS, type FontId } from '../../lib/siteTheme'
import type { SetSite } from './types'
import './MeuSite.css'

const paletteVars = (id: PaletteId) => ({ '--bg': PALETTES[id].bg, '--accent': PALETTES[id].accent }) as CSSProperties
const fontVars = (id: FontId) =>
  ({ '--ff': FONTS[id].family, '--fw': FONTS[id].weight, '--tt': FONTS[id].upper ? 'uppercase' : 'none' }) as CSSProperties

/** paleta de cores (duas cores por opção) */
export function PaletteOptions({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  return (
    <div className="swatches">
      {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
        <label key={id} className="swatch">
          <input type="radio" name="palette" checked={site.palette === id} onChange={() => setSite('palette', id)} />
          <span className="swatch__dot swatch__dot--duo" style={paletteVars(id)} />
          {PALETTES[id].label}
        </label>
      ))}
    </div>
  )
}

/** fonte dos títulos, cada opção escrita na própria fonte */
export function FontOptions({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  return (
    <div className="swatches">
      {(Object.keys(FONTS) as FontId[]).map((id) => (
        <label key={id} className="swatch swatch--font">
          <input type="radio" name="font" checked={site.font === id} onChange={() => setSite('font', id)} />
          <span className="swatch__font" style={fontVars(id)}>
            {FONTS[id].label}
          </span>
        </label>
      ))}
    </div>
  )
}

/** aparência: paleta e fonte */
export function AppearanceFields({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  return (
    <>
      <fieldset className="field">
        <legend className="field__label">Paleta de cores</legend>
        <PaletteOptions site={site} setSite={setSite} />
      </fieldset>
      <fieldset className="field">
        <legend className="field__label">Fonte dos títulos</legend>
        <FontOptions site={site} setSite={setSite} />
      </fieldset>
    </>
  )
}

export { fontVars, paletteVars }

import { useRef, useState, type ChangeEvent } from 'react'
import { Check, CircleUserRound, ImagePlus, PanelsLeftBottom, Trash2 } from 'lucide-react'
import { brandUrl, PALETTES, type SiteConfig } from '../../data/catalog'
import { COVER_STYLES, coverPattern, type CoverStyleId } from '../../lib/siteTheme'
import { resizeToDataUrl } from '../../lib/imageResize'
import { Button } from '../../components/ui'
import { paletteVars } from './AppearanceFields'
import { Group } from './Group'
import type { SetSite } from './types'
import './MeuSite.css'

/** foto de perfil (ou logo): miniatura, escolher/trocar e remover */
function ImageField({
  value,
  round,
  titleEmpty,
  titleFilled,
  hint,
  removeLabel,
  onFile,
  onClear,
}: {
  value: string
  round?: boolean
  titleEmpty: string
  titleFilled: string
  hint: string
  removeLabel: string
  onFile: (file: File) => void
  onClear: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const thumb = ['logofield__thumb', round && 'logofield__thumb--round'].filter(Boolean).join(' ')
  return (
    <div className="logofield">
      <span className={thumb} aria-hidden="true">
        {value ? <img src={value} alt="" /> : <ImagePlus size={22} />}
      </span>
      <div className="logofield__text">
        <p>{value ? titleFilled : titleEmpty}</p>
        <small>{hint}</small>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
      <Button variant="light" size="sm" onClick={() => input.current?.click()}>
        {value ? 'Trocar' : 'Escolher'}
      </Button>
      {value && (
        <button type="button" className="chevbtn" aria-label={removeLabel} onClick={onClear}>
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}

/**
 * capa: lisa, uma das seis texturas (desenhadas nas cores da paleta) ou a foto da própria pessoa.
 * A foto passa na frente; escolher uma textura tira a foto (o Descartar traz de volta).
 */
function CoverPicker({ site, setSite, onFile }: { site: SiteConfig; setSite: SetSite; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const photo = brandUrl(site.cover)
  const pal = PALETTES[site.palette]
  const choose = (id: CoverStyleId) => {
    if (site.cover) setSite('cover', '')
    setSite('coverStyle', id)
  }
  return (
    <>
      <div className="coverpick" role="radiogroup" aria-label="Capa" style={paletteVars(site.palette)}>
        {(Object.keys(COVER_STYLES) as CoverStyleId[]).map((id) => {
          const on = !photo && site.coverStyle === id
          return (
            <button key={id} type="button" role="radio" aria-checked={on} className="coverpick__opt" onClick={() => choose(id)}>
              <span
                className={`coverpick__tile coverpick__tile--${id}`}
                style={{ background: coverPattern(id, pal, 0.5) ?? undefined }}
                aria-hidden="true"
              >
                <span className="coverpick__check">
                  <Check size={14} strokeWidth={2.75} />
                </span>
              </span>
              <strong>{COVER_STYLES[id].label}</strong>
            </button>
          )
        })}
        <button type="button" role="radio" aria-checked={Boolean(photo)} className="coverpick__opt" onClick={() => input.current?.click()}>
          <span className="coverpick__tile coverpick__tile--foto" aria-hidden="true">
            {photo ? <img src={photo} alt="" /> : <ImagePlus size={20} />}
            <span className="coverpick__check">
              <Check size={14} strokeWidth={2.75} />
            </span>
          </span>
          <strong>{photo ? 'Trocar foto' : 'Sua foto'}</strong>
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
      {photo && (
        <button type="button" className="coverpick__remove" onClick={() => setSite('cover', '')}>
          <Trash2 size={14} aria-hidden="true" />
          Tirar a foto da capa
        </button>
      )}
    </>
  )
}

type Profile = 'foto' | 'capa'

const PROFILES: { id: Profile; title: string; hint: string }[] = [
  { id: 'foto', title: 'Com foto de perfil', hint: 'Seu rosto ou logo, redondo ao lado do nome' },
  { id: 'capa', title: 'Só com a capa', hint: 'Foto grande de fundo e os dados ao lado' },
]

/** ícone de cada tipo de perfil */
function ProfileIcon({ id }: { id: Profile }) {
  return <span className="profilepick__icon">{id === 'foto' ? <CircleUserRound size={28} strokeWidth={1.6} aria-hidden="true" /> : <PanelsLeftBottom size={28} strokeWidth={1.6} aria-hidden="true" />}</span>
}

/** foto de perfil (ou logo) e capa: a imagem é reduzida no navegador antes de entrar no rascunho */
export function IdentityFields({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  const [error, setError] = useState<string | null>(null)
  // com foto escolhida, o tipo é sempre "com foto"; sem ela, vale a escolha feita aqui
  const [chosen, setChosen] = useState<Profile>(site.logo ? 'foto' : 'capa')
  const profile: Profile = site.logo ? 'foto' : chosen

  const pick = (kind: 'logo' | 'cover') => async (file: File) => {
    setError(null)
    try {
      setSite(kind, kind === 'logo' ? await resizeToDataUrl(file) : await resizeToDataUrl(file, 1000, 280_000))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível usar essa imagem.')
    }
  }

  const choose = (id: Profile) => {
    setChosen(id)
    // "só com a capa" é o perfil sem foto: a foto sai (o Descartar traz de volta)
    if (id === 'capa' && site.logo) setSite('logo', '')
  }

  return (
    <>
      <Group title="Tipo de perfil">
        <div className="profilepick" role="radiogroup" aria-label="Tipo de perfil">
          {PROFILES.map((p) => (
            <label key={p.id} className="profilepick__opt">
              <input type="radio" name="profile" checked={profile === p.id} onChange={() => choose(p.id)} />
              <ProfileIcon id={p.id} />
              <strong>{p.title}</strong>
              <small>{p.hint}</small>
              <span className="profilepick__check">
                <Check size={13} aria-hidden="true" />
              </span>
            </label>
          ))}
        </div>
      </Group>
      {profile === 'foto' && (
        <Group title="Foto de perfil">
          <ImageField
            value={brandUrl(site.logo)}
            round
            titleEmpty="Adicione sua foto de perfil"
            titleFilled="Foto de perfil"
            hint="Seu rosto ou o logo do negócio"
            removeLabel="Remover foto de perfil"
            onFile={(f) => void pick('logo')(f)}
            onClear={() => setSite('logo', '')}
          />
        </Group>
      )}
      <Group title="Capa">
        <CoverPicker site={site} setSite={setSite} onFile={(f) => void pick('cover')(f)} />
        {error && (
          <p className="field__hint" role="alert">
            {error}
          </p>
        )}
      </Group>
    </>
  )
}

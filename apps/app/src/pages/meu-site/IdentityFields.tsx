import { useRef, useState, type ChangeEvent } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import type { SiteConfig } from '../../data/catalog'
import { resizeToDataUrl } from '../../lib/imageResize'
import { Button } from '../../components/ui'
import { Group } from './Group'
import type { SetSite } from './types'
import './MeuSite.css'

/** logo e capa tratam a imagem do mesmo jeito; só mudam o tamanho máximo e os textos */
function ImageField({
  value,
  wide,
  titleEmpty,
  titleFilled,
  hint,
  removeLabel,
  onFile,
  onClear,
}: {
  value: string
  wide?: boolean
  titleEmpty: string
  titleFilled: string
  hint: string
  removeLabel: string
  onFile: (file: File) => void
  onClear: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="logofield">
      <span className={`logofield__thumb ${wide ? 'logofield__thumb--wide' : ''}`.trim()} aria-hidden="true">
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

/** logo e foto de capa: a imagem é reduzida no navegador antes de entrar no rascunho */
export function IdentityFields({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  const [error, setError] = useState<string | null>(null)
  const pick = (kind: 'logo' | 'cover') => async (file: File) => {
    setError(null)
    try {
      setSite(kind, kind === 'logo' ? await resizeToDataUrl(file) : await resizeToDataUrl(file, 1000, 280_000))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível usar essa imagem.')
    }
  }
  return (
    <Group title="Logo e capa">
      <ImageField
        value={site.logo}
        titleEmpty="Adicione seu logo"
        titleFilled="Seu logo"
        hint="PNG, JPG ou WebP"
        removeLabel="Remover logo"
        onFile={(f) => void pick('logo')(f)}
        onClear={() => setSite('logo', '')}
      />
      <ImageField
        value={site.cover}
        wide
        titleEmpty="Adicione uma foto de capa"
        titleFilled="Foto de capa"
        hint="Foto grande do topo do site"
        removeLabel="Remover foto de capa"
        onFile={(f) => void pick('cover')(f)}
        onClear={() => setSite('cover', '')}
      />
      {error && (
        <p className="field__hint" role="alert">
          {error}
        </p>
      )}
    </Group>
  )
}

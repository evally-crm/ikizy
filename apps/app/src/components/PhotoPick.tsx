import './PhotoPick.css'
import { useRef, useState, type ChangeEvent } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { resizeToDataUrl } from '../lib/imageResize'

/** quadradinho de foto: toque para escolher, X para tirar. A imagem é reduzida no navegador antes de ir para o rascunho. */
export default function PhotoPick({
  src,
  label,
  onPick,
  onClear,
}: {
  /** endereço da foto atual ('' = sem foto) */
  src: string
  label: string
  onPick: (dataUrl: string) => void
  onClear: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      onPick(await resizeToDataUrl(file, 700, 150_000))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível usar essa imagem.')
    }
  }

  return (
    <span className="photopick">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void onChange(e)} />
      <button
        type="button"
        className="photopick__btn"
        aria-label={src ? `Trocar foto: ${label}` : `Adicionar foto: ${label}`}
        title={src ? 'Trocar foto' : 'Adicionar foto'}
        onClick={() => input.current?.click()}
      >
        {src ? <img src={src} alt="" /> : <ImagePlus size={20} aria-hidden="true" />}
      </button>
      {src && (
        <button type="button" className="photopick__x" aria-label={`Tirar foto: ${label}`} title="Tirar foto" onClick={onClear}>
          <X size={12} aria-hidden="true" />
        </button>
      )}
      {error && (
        <small className="photopick__err" role="alert">
          {error}
        </small>
      )}
    </span>
  )
}

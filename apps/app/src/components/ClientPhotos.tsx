import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Camera, ChevronLeft, ChevronRight, Columns2, ImagePlus, Trash2, X } from 'lucide-react'
import type { ClientPhoto, NewPhoto, PhotoKind } from '../data/useClientBook'
import { resizeToDataUrl } from '../lib/imageResize'
import { Button, Card } from './ui'
import { ConfirmDialog, Modal } from './Modal'

type Result = Promise<string | null>

const KIND_LABEL: Record<PhotoKind, string> = { antes: 'Antes', depois: 'Depois', outra: 'Foto' }
const KINDS: PhotoKind[] = ['antes', 'depois', 'outra']
const MAX_FILES = 6

const dayLabel = (iso: string) => format(parseISO(iso), "dd 'de' MMM yyyy", { locale: ptBR })

/** agrupa por dia de atendimento, com antes primeiro e depois em seguida */
function byDay(photos: ClientPhoto[]) {
  const order: Record<PhotoKind, number> = { antes: 0, depois: 1, outra: 2 }
  const map = new Map<string, ClientPhoto[]>()
  for (const p of photos) map.set(p.takenOn, [...(map.get(p.takenOn) ?? []), p])
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => ({ day, list: [...list].sort((a, b) => order[a.kind] - order[b.kind]) }))
}

/* ------------------------------------------------------------------ card */

export function PhotosCard({
  photos,
  loading,
  error,
  limit,
  onAdd,
  onOpen,
  onSeeAll,
}: {
  photos: ClientPhoto[]
  loading: boolean
  error: string | null
  /** no resumo mostramos só as últimas */
  limit?: number
  onAdd: () => void
  onOpen: (id: string) => void
  onSeeAll?: () => void
}) {
  const groups = useMemo(() => byDay(photos), [photos])
  const latest = limit ? photos.slice(0, limit) : []

  return (
    <Card className={limit ? '' : 'detail-grid__wide'}>
      <div className="card__head">
        <div>
          <p className="eyebrow">Fotos</p>
          <h3 className="card__title">Antes e depois</h3>
        </div>
        {photos.length > 0 && (
          <Button size="sm" variant="light" onClick={onAdd}>
            <ImagePlus size={15} aria-hidden="true" /> Adicionar
          </Button>
        )}
      </div>

      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="card__sub">Carregando fotos…</p>}

      {!loading && photos.length === 0 && (
        <button type="button" className="photos__empty" onClick={onAdd}>
          <Camera size={22} aria-hidden="true" />
          <strong>Registre o antes e o depois</strong>
          <span>Fotos do atendimento ficam só aqui na ficha, visíveis apenas para a sua equipe.</span>
        </button>
      )}

      {limit ? (
        photos.length > 0 && (
          <>
            <div className="photos__grid">
              {latest.map((p) => (
                <Thumb key={p.id} photo={p} onOpen={onOpen} />
              ))}
            </div>
            {onSeeAll && photos.length > latest.length && (
              <button type="button" className="textlink photos__more" onClick={onSeeAll}>
                Ver todas ({photos.length})
              </button>
            )}
          </>
        )
      ) : (
        groups.map((g) => (
          <section key={g.day} className="photos__day">
            <p className="photos__date">
              {dayLabel(g.day)}
              {g.list.find((p) => p.caption) && <span> · {g.list.find((p) => p.caption)?.caption}</span>}
            </p>
            <div className="photos__grid">
              {g.list.map((p) => (
                <Thumb key={p.id} photo={p} onOpen={onOpen} />
              ))}
            </div>
          </section>
        ))
      )}
    </Card>
  )
}

function Thumb({ photo, onOpen }: { photo: ClientPhoto; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="photos__thumb" onClick={() => onOpen(photo.id)} aria-label={`${KIND_LABEL[photo.kind]}, ${dayLabel(photo.takenOn)}`}>
      <img src={photo.thumb} alt="" loading="lazy" />
      <span className={`photos__kind photos__kind--${photo.kind}`}>{KIND_LABEL[photo.kind]}</span>
    </button>
  )
}

/* ------------------------------------------------------------------ adicionar */

interface Picked {
  key: string
  kind: PhotoKind
  thumb: string
  data: string
}

export function AddPhotosDialog({ onSave, onClose }: { onSave: (items: NewPhoto[]) => Result; onClose: () => void }) {
  const [items, setItems] = useState<Picked[]>([])
  const [takenOn, setTakenOn] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [caption, setCaption] = useState('')
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].slice(0, MAX_FILES - items.length)
    e.target.value = ''
    if (!files.length) return
    setError(null)
    setReading(true)
    const next: Picked[] = []
    for (const file of files) {
      try {
        const [data, thumb] = await Promise.all([resizeToDataUrl(file, 1280, 350_000), resizeToDataUrl(file, 360, 40_000)])
        // a primeira foto costuma ser o antes e a segunda o depois
        const kind: PhotoKind = items.length + next.length === 0 ? 'antes' : items.length + next.length === 1 ? 'depois' : 'outra'
        next.push({ key: `${file.name}-${file.lastModified}-${Math.random()}`, kind, thumb, data })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível ler essa imagem.')
      }
    }
    setItems((list) => [...list, ...next])
    setReading(false)
  }

  const save = async () => {
    setBusy(true)
    const err = await onSave(items.map((i) => ({ kind: i.kind, caption: caption.trim(), takenOn, thumb: i.thumb, data: i.data })))
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <Modal label="Adicionar fotos" onClose={onClose} wide>
      <div className="dialog__head">
        <h2>Adicionar fotos</h2>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      <div className="form">
        <div className="photos__picked">
          {items.map((i) => (
            <div key={i.key} className="photos__pick">
              <img src={i.thumb} alt="" />
              <button
                type="button"
                className="photos__remove"
                aria-label="Tirar esta foto"
                onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}
              >
                <X size={14} />
              </button>
              <span className="yn photos__kinds" role="group" aria-label="Tipo da foto">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={i.kind === k}
                    onClick={() => setItems((list) => list.map((x) => (x.key === i.key ? { ...x, kind: k } : x)))}
                  >
                    {k === 'outra' ? 'Outra' : KIND_LABEL[k]}
                  </button>
                ))}
              </span>
            </div>
          ))}
          {items.length < MAX_FILES && (
            <label className={`photos__drop ${items.length ? '' : 'is-big'}`}>
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={pick} disabled={reading} />
              <Camera size={22} aria-hidden="true" />
              <strong>{reading ? 'Preparando…' : items.length ? 'Mais fotos' : 'Tirar ou escolher fotos'}</strong>
              {!items.length && <span>Até {MAX_FILES} de uma vez. Elas são reduzidas antes de salvar.</span>}
            </label>
          )}
        </div>

        <div className="form__pair">
          <label className="field">
            <span className="field__label">Data do atendimento</span>
            <span className="input">
              <input type="date" value={takenOn} max={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setTakenOn(e.target.value)} required />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Legenda (opcional)</span>
            <span className="input">
              <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={80} placeholder="Ex.: Alongamento em gel" />
            </span>
          </label>
        </div>
      </div>

      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}

      <div className="dialog__actions">
        <Button variant="light" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!items.length || !takenOn || busy || reading} onClick={save}>
          {busy ? 'Salvando…' : items.length > 1 ? `Salvar ${items.length} fotos` : 'Salvar foto'}
        </Button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ ver */

function useFull(photo: ClientPhoto | undefined, loadFull: (id: string) => Result) {
  const [full, setFull] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!photo || full[photo.id]) return
    let cancelled = false
    void loadFull(photo.id).then((src) => {
      if (!cancelled && src) setFull((m) => ({ ...m, [photo.id]: src }))
    })
    return () => {
      cancelled = true
    }
  }, [photo, full, loadFull])
  return photo ? (full[photo.id] ?? photo.thumb) : ''
}

export function PhotoViewer({
  photos,
  startId,
  loadFull,
  onRemove,
  onClose,
}: {
  photos: ClientPhoto[]
  startId: string
  loadFull: (id: string) => Result
  onRemove: (id: string) => Result
  onClose: () => void
}) {
  const [id, setId] = useState(startId)
  const [compare, setCompare] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const index = Math.max(0, photos.findIndex((p) => p.id === id))
  const photo = photos[index]
  // par do mesmo dia (antes ↔ depois) para comparar lado a lado
  const pair = photo && photo.kind !== 'outra' ? photos.find((p) => p.takenOn === photo.takenOn && p.kind === (photo.kind === 'antes' ? 'depois' : 'antes')) : undefined
  const before = photo?.kind === 'depois' ? pair : photo
  const after = photo?.kind === 'depois' ? photo : pair
  const src = useFull(photo, loadFull)
  const beforeSrc = useFull(compare ? before : undefined, loadFull)
  const afterSrc = useFull(compare ? after : undefined, loadFull)

  const go = (step: number) => {
    const next = photos[(index + step + photos.length) % photos.length]
    if (next) setId(next.id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!photo) return null
  const showCompare = compare && before && after

  return (
    <Modal label="Foto" onClose={onClose} wide>
      <div className="dialog__head">
        <div>
          <p className="eyebrow">{showCompare ? 'Antes e depois' : KIND_LABEL[photo.kind]}</p>
          <h2 className="viewer__title">
            {dayLabel(photo.takenOn)}
            {photo.caption && <small> · {photo.caption}</small>}
          </h2>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      {showCompare ? (
        <div className="viewer__pair">
          <figure>
            <img src={beforeSrc} alt="Antes" />
            <figcaption>Antes</figcaption>
          </figure>
          <figure>
            <img src={afterSrc} alt="Depois" />
            <figcaption>Depois</figcaption>
          </figure>
        </div>
      ) : (
        <div className="viewer__stage">
          <img src={src} alt={`${KIND_LABEL[photo.kind]} em ${dayLabel(photo.takenOn)}`} />
          {photos.length > 1 && (
            <>
              <button type="button" className="viewer__nav viewer__nav--prev" aria-label="Foto anterior" onClick={() => go(-1)}>
                <ChevronLeft size={20} />
              </button>
              <button type="button" className="viewer__nav viewer__nav--next" aria-label="Próxima foto" onClick={() => go(1)}>
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}

      <div className="viewer__bar">
        <span className="card__sub">
          {index + 1} de {photos.length}
        </span>
        <div className="viewer__actions">
          {pair && (
            <Button size="sm" variant={compare ? 'primary' : 'light'} onClick={() => setCompare(!compare)}>
              <Columns2 size={15} aria-hidden="true" /> {compare ? 'Ver uma' : 'Lado a lado'}
            </Button>
          )}
          <Button size="sm" variant="light" onClick={() => setConfirm(true)}>
            <Trash2 size={15} aria-hidden="true" /> Apagar
          </Button>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title="Apagar foto?"
          text="Ela sai da ficha da cliente e não dá para desfazer."
          confirmLabel="Apagar"
          onConfirm={async () => {
            // vizinha escolhida antes de apagar, enquanto a lista ainda tem a foto atual
            const neighbor = photos[index + 1] ?? photos[index - 1]
            const err = await onRemove(photo.id)
            if (err) return setError(err)
            setCompare(false)
            if (neighbor) setId(neighbor.id)
            else onClose()
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </Modal>
  )
}

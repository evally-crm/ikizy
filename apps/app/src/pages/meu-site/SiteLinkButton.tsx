import { useState } from 'react'
import { Check, Copy, ExternalLink, Pencil } from 'lucide-react'
import { Button, Field, Sheet } from '../../components/ui'
import { cleanSlug } from '../../domain/site'
import { SITE_DOMAIN, siteHost } from '../../lib/slug'
import './MeuSite.css'

/**
 * Endereço do site sempre à mão no topo do Meu site: tocar abre uma folha para copiar, abrir ou mudar o endereço.
 * Trocar o endereço de um site publicado vale só no próximo Publicar, e os links antigos deixam de funcionar.
 */
export function SiteLinkButton({
  slug,
  publishedSlug,
  isLive,
  offline,
  reserved,
  onSlug,
  className,
}: {
  slug: string
  publishedSlug: string
  isLive: boolean
  offline: boolean
  reserved: boolean
  onSlug: (slug: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const host = siteHost(slug)
  const liveUrl = `https://${siteHost(publishedSlug)}`
  const changed = isLive && slug !== publishedSlug

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${host}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* sem permissão da área de transferência: a pessoa copia o texto do campo */
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={`Endereço do site: ${host}. Abrir opções`}>
        <span>
          {host}
          {offline && ' · fora do ar'}
          {!isLive && ' · ainda não publicado'}
        </span>
        <Pencil size={12} aria-hidden="true" />
      </button>
      {open && (
        <Sheet
          label="Endereço do site"
          onClose={() => setOpen(false)}
          actions={
            <>
              <Button variant="light" onClick={() => void copy()}>
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? 'Copiado' : 'Copiar link'}
              </Button>
              {isLive && (
                <a className="btn btn--light" href={liveUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} aria-hidden="true" /> Abrir
                </a>
              )}
              <Button onClick={() => setOpen(false)}>Pronto</Button>
            </>
          }
        >
          <h2 className="sheet__title">Endereço do site</h2>
          <Field
            label="Endereço da página"
            hint={reserved ? 'Esse endereço é reservado. Escolha outro.' : 'É o link que você coloca no Instagram e no WhatsApp.'}
          >
            {(id) => (
              <span className="input input--suffix">
                <input id={id} value={slug} maxLength={40} aria-invalid={reserved} onChange={(e) => onSlug(cleanSlug(e.target.value))} />
                <span aria-hidden="true">.{SITE_DOMAIN}</span>
              </span>
            )}
          </Field>
          {!isLive && <p className="field__hint">O link só funciona depois que você publicar o site.</p>}
          {changed && (
            <p className="field__hint" role="alert">
              Ao publicar, o endereço antigo ({siteHost(publishedSlug)}) deixa de funcionar. Avise quem já recebeu o link.
            </p>
          )}
        </Sheet>
      )}
    </>
  )
}

import type { SVGProps } from 'react'
import { WHATSAPP_PATH } from '../lib/social'

/**
 * logos das redes (o ícone de contorno do Instagram e o balão com o telefone do WhatsApp), no tamanho e na cor do texto.
 * O lucide não traz marcas, então ficam aqui. As mesmas formas estão em api/_lib/siteHtml.ts (página pública).
 */
type Props = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & { size?: number }

export function InstagramIcon({ size = 16, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.3" cy="6.7" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function WhatsAppIcon({ size = 16, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" {...rest}>
      <path d={WHATSAPP_PATH} />
    </svg>
  )
}


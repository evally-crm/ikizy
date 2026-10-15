import { useEffect, useState } from 'react'

/** duração da animação de saída dos painéis (igual ao CSS de `.is-closing`) */
export const EXIT_MS = 240

/**
 * mantém um painel na tela um instante depois de fechado, para a animação de saída rodar:
 * `mounted` diz se renderiza; `closing` vira true enquanto ele some
 */
export function usePresence(open: boolean, ms = EXIT_MS) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    if (open || !mounted) return
    const t = window.setTimeout(() => setMounted(false), ms)
    return () => window.clearTimeout(t)
  }, [open, mounted, ms])

  return { mounted: open || mounted, closing: !open && mounted }
}

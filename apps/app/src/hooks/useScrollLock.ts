import { useEffect } from 'react'

/** trava a rolagem da página enquanto `locked` é verdadeiro (telas que cobrem tudo) */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked])
}

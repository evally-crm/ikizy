/**
 * Instalar o app na tela inicial. O Chrome/Android avisa uma vez (beforeinstallprompt) e só aceita mostrar o
 * pedido depois de um toque; guardamos o aviso aqui, desde o carregamento, para o botão usar quando quiser.
 * O iPhone não tem esse aviso: lá mostramos o passo a passo (Compartilhar > Adicionar à Tela de Início).
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export const onInstallChange = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** já está aberto como app (instalado) */
export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

export const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

export const canPrompt = () => deferred !== null

/** abre o pedido de instalação do navegador; true se a pessoa aceitou */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const event = deferred
  deferred = null
  await event.prompt()
  const { outcome } = await event.userChoice
  notify()
  return outcome === 'accepted'
}

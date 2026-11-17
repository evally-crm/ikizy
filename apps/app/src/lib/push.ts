import { post } from './billingApi'
import { urlBase64ToBytes } from './deviceInfo'

/**
 * avisos no aparelho (Web Push) de pedido novo pelo site. O service worker (public/sw.js) mostra o aviso e abre o pedido ao tocar;
 * aqui fica a parte da tela: saber em que pé está este aparelho, ligar e desligar.
 */

export type PushState =
  /** o navegador não sabe receber avisos */
  | 'unsupported'
  /** iPhone/iPad: só recebe avisos com o app instalado na tela inicial */
  | 'needs-install'
  /** o servidor ainda não tem as chaves, ou não respondeu: a tela esconde a opção */
  | 'unavailable'
  /** a pessoa bloqueou os avisos nas configurações do navegador */
  | 'denied'
  | 'off'
  | 'on'

const canPush = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
/** está rodando como app instalado (e não numa aba do navegador)? */
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

/** garante o service worker registrado (em produção o main.tsx já faz; aqui cobre o caso de ainda não ter terminado) */
async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/sw.js')
  if (existing) return existing
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export async function pushState(): Promise<PushState> {
  if (!canPush()) return isIos() && !isInstalled() ? 'needs-install' : 'unsupported'
  let key: string | null
  try {
    key = (await post<{ publicKey: string | null }>('/api/account/push-config', {})).publicKey
  } catch {
    return 'unavailable'
  }
  if (!key) return 'unavailable'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

/** liga o aviso neste aparelho (precisa vir de um toque da pessoa, porque o navegador pergunta a permissão); devolve a frase de erro ou null */
export async function enablePush(): Promise<string | null> {
  if (!canPush()) return 'Este navegador não recebe avisos.'
  try {
    const { publicKey } = await post<{ publicKey: string | null }>('/api/account/push-config', {})
    if (!publicKey) return 'Os avisos ainda não estão ligados.'
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'Para receber os avisos, permita as notificações quando o navegador perguntar.'
    const reg = await registration()
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) as BufferSource }))
    await post('/api/account/push-subscribe', { subscription: sub.toJSON(), userAgent: navigator.userAgent })
    return null
  } catch (e) {
    const message = (e as { message?: string }).message
    return message && /^[A-ZÀ-Ú]/.test(message) && message.length < 140 && /[.!]$/.test(message) ? message : 'Não foi possível ligar os avisos agora. Tente novamente.'
  }
}

/** desliga o aviso neste aparelho */
export async function disablePush(): Promise<string | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await post('/api/account/push-unsubscribe', { endpoint: sub.endpoint })
      await sub.unsubscribe()
    }
    return null
  } catch {
    return 'Não foi possível desligar agora. Tente novamente.'
  }
}

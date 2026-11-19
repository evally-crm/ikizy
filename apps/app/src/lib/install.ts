import { useSyncExternalStore } from 'react'
import { isInstalled } from './push'

/**
 * instalar o IKIZY como app. O navegador (Chrome, Edge e outros) entrega o evento `beforeinstallprompt` uma vez só, logo no começo;
 * por isso ele é guardado aqui, fora da tela, e qualquer lugar do sistema pode usar. O Safari do iPhone não tem esse evento: lá o jeito
 * é Compartilhar > Adicionar à Tela de Início, então só mostramos o passo a passo.
 */

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const isIos = () =>
  typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

let deferred: InstallEvent | null = null
let installed = false
let version = 0
const listeners = new Set<() => void>()
const emit = () => {
  version += 1
  listeners.forEach((l) => l())
}

/** chamado uma vez no main.tsx, antes de a tela existir, para não perder o evento */
export function startInstallWatch() {
  if (typeof window === 'undefined') return
  installed = isInstalled()
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
}

/** abre o pedido de instalação do navegador; devolve se a pessoa aceitou */
export async function promptInstall(): Promise<boolean> {
  const e = deferred
  if (!e) return false
  deferred = null
  emit()
  await e.prompt()
  const { outcome } = await e.userChoice
  return outcome === 'accepted'
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export type InstallInfo = {
  /** já está rodando como app */
  installed: boolean
  /** o navegador tem o botão pronto (Chrome/Edge/Android) */
  canPrompt: boolean
  /** iPhone/iPad fora do app: precisa do passo a passo */
  needsSteps: boolean
}

export function useInstall(): InstallInfo {
  useSyncExternalStore(subscribe, () => version)
  return {
    installed,
    canPrompt: deferred !== null && !installed,
    needsSteps: isIos() && !installed,
  }
}

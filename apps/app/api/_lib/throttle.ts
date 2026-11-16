import { HttpError } from './billing.js'
import { reportError } from './monitoring.js'

/**
 * limite de pedidos por pessoa nas rotas com login (tabela `rate_limits`, a mesma do agendamento).
 * Segura quem tenta adivinhar o texto de confirmação da exclusão, abusa da cobrança ou enche a loja de fotos.
 */

export interface Limiter {
  /** registra uma tentativa; true = passou do limite */
  limited(bucket: string, max: number, windowSeconds: number): Promise<boolean>
}

/** quantas chamadas cada rota aceita por pessoa, e em quantos segundos */
export const LIMITS = {
  'account:delete': { max: 5, window: 3600 },
  'account:admin-delete': { max: 20, window: 3600 },
  'account:export': { max: 5, window: 3600 },
  'account:summary': { max: 60, window: 60 },
  'account:push-config': { max: 60, window: 60 },
  'account:push-subscribe': { max: 20, window: 3600 },
  'account:push-unsubscribe': { max: 60, window: 3600 },
  'account:admin-salons': { max: 30, window: 60 },
  'account:admin-log': { max: 30, window: 60 },
  'account:cancel-delete': { max: 20, window: 3600 },
  'account:me': { max: 60, window: 60 },
  'account:sync-email': { max: 30, window: 60 },
  billing: { max: 30, window: 600 },
  'photos:upload': { max: 120, window: 600 },
} as const

export type LimitKey = keyof typeof LIMITS

/** recusa com 429 quem passou do limite. Se o limitador falhar, deixa passar (e registra): ele nunca derruba a rota */
export async function throttle(db: Limiter, userId: string, key: LimitKey): Promise<void> {
  const { max, window } = LIMITS[key]
  let blocked = false
  try {
    blocked = await db.limited(`user:${key}:${userId}`, max, window)
  } catch (error) {
    reportError(error, 'limitador por pessoa indisponível')
    return
  }
  if (blocked) throw new HttpError(429, 'too_many', 'Muitas tentativas seguidas. Espere um pouco e tente de novo.')
}

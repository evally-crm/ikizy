import * as Sentry from '@sentry/node'
import { waitUntil } from '@vercel/functions'

/**
 * monitoramento de erros (Sentry) nas funções da Vercel. Só liga com SENTRY_DSN; sem ela, só o console.error de sempre.
 * Sem dados pessoais: nada de IP, corpo do pedido ou cabeçalhos (o token de login fica de fora).
 */
let started: boolean | undefined

function start(): boolean {
  if (started !== undefined) return started
  const dsn = process.env.SENTRY_DSN
  started = Boolean(dsn)
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? 'development',
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate: 0,
      defaultIntegrations: false,
      beforeSend(event) {
        delete event.request
        delete event.user
        return event
      },
    })
  }
  return started
}

/** registra um erro inesperado; `where` diz de onde veio (ex.: "booking", "cron expire-requests") */
export function reportError(error: unknown, where?: string): void {
  console.error(where ?? 'erro', error)
  if (!start()) return
  Sentry.captureException(error, where ? { tags: { where } } : undefined)
  // a função da Vercel pode parar logo depois da resposta: o envio termina antes disso
  try {
    waitUntil(Sentry.flush(2000))
  } catch {
    /* fora da Vercel (testes) não há waitUntil */
  }
}

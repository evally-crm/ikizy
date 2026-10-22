/**
 * monitoramento de erros (Sentry) no navegador. Só liga com VITE_SENTRY_DSN configurada na Vercel;
 * sem ela não faz nada e a biblioteca nem é baixada.
 * Privacidade: sem gravação de tela, sem IP nem dados pessoais, e textos digitados não vão junto.
 */
export function startMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn || import.meta.env.DEV) return
  void import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined,
        beforeSendTransaction: () => null,
        // só erros, sem medir desempenho (fica no plano grátis)
        tracesSampleRate: 0,
        beforeSend(event) {
          // o endereço pode trazer o e-mail (ex.: /verificar-email?email=...)
          if (event.request?.url) event.request.url = event.request.url.split('?')[0]
          return event
        },
        beforeBreadcrumb(crumb) {
          if (crumb.category === 'ui.input') return null
          if (typeof crumb.data?.url === 'string') crumb.data.url = crumb.data.url.split('?')[0]
          return crumb
        },
      })
    })
    .catch(() => {})
}

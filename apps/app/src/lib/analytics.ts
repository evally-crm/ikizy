/**
 * métricas de uso (PostHog) no navegador: quais telas e funções as pessoas usam. Só liga com VITE_POSTHOG_KEY
 * configurada na Vercel e fora do `npm run dev`; sem ela não faz nada e a biblioteca nem é baixada.
 * Privacidade (LGPD): sem gravação de tela, sem e-mail nem nome, textos digitados não vão junto e o endereço
 * vai sem a parte depois do "?" (ex.: /verificar-email?email=...). A pessoa é identificada só pelo id interno.
 */
import type { PostHog } from 'posthog-js'

type Call = (ph: PostHog) => void

let client: PostHog | null = null
let queue: Call[] | null = null

const stripQuery = (url: unknown) => (typeof url === 'string' ? url.split('?')[0].split('#')[0] : url)

/** roda agora se o PostHog já carregou; senão guarda para quando carregar (ou descarta, se estiver desligado) */
function run(call: Call): void {
  if (client) call(client)
  else if (queue) queue.push(call)
}

export function startAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  if (!key || import.meta.env.DEV || queue || client) return
  queue = []
  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com',
        defaults: '2025-05-24',
        // perfil só para quem está logada; visitas anônimas contam, mas não viram pessoa
        person_profiles: 'identified_only',
        // a troca de tela do React Router vira pageview sozinha (history change)
        capture_pageview: 'history_change',
        autocapture: true,
        disable_session_recording: true,
        mask_all_text: false,
        mask_all_element_attributes: false,
        before_send(event) {
          if (!event) return event
          const p = event.properties
          for (const k of ['$current_url', '$referrer', '$initial_referrer', '$pathname']) {
            if (k in p) p[k] = stripQuery(p[k])
          }
          if (event.$set) delete event.$set.$email
          return event
        },
      })
      posthog.register({ environment: import.meta.env.MODE })
      client = posthog
      const pending = queue ?? []
      queue = null
      pending.forEach((call) => call(posthog))
    })
    .catch(() => {
      queue = null
    })
}

/** liga os eventos à conta e ao negócio (sem e-mail nem nome) */
export function identifyUser(userId: string, salon: { id: string; role: string } | null): void {
  run((ph) => {
    ph.identify(userId, salon ? { role: salon.role } : undefined)
    if (salon) ph.group('salon', salon.id)
  })
}

/** ao sair: as próximas ações não ficam na conta de quem saiu */
export function resetAnalytics(): void {
  run((ph) => ph.reset())
}

/** evento de produto, ex.: track('agendamento_criado', { origem: 'agenda' }). Nunca mande dados pessoais. */
export function track(event: string, properties?: Record<string, string | number | boolean | null>): void {
  run((ph) => ph.capture(event, properties))
}

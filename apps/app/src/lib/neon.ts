import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL as string | undefined

/** sem as variáveis, o app roda em modo demonstração com dados de exemplo */
export const isNeonConfigured = Boolean(authUrl && dataApiUrl)

/** adaptador Supabase: mantém signInWithPassword, signUp, getSession etc. sobre o Neon Auth */
export const neon = isNeonConfigured
  ? createClient({
      auth: { adapter: SupabaseAuthAdapter(), url: authUrl! },
      dataApi: { url: dataApiUrl! },
    })
  : null

export type NeonSession = NonNullable<Awaited<ReturnType<NonNullable<typeof neon>['auth']['getSession']>>['data']['session']>

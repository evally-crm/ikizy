import { neon } from './neon'
import { passwordErrorMessage, toDevices, type AuthErr, type Device, type RawSession } from './deviceInfo'

/**
 * Segurança da conta com a pessoa logada: trocar a senha e ver/encerrar os aparelhos conectados.
 * Usa o Better Auth do Neon Auth direto (como o resto de AuthProvider): o cliente do Neon LANÇA o erro em vez de devolver { error },
 * então as duas formas viram uma só. (Trocar o e-mail está desligado no servidor de login do Neon, por isso não há tela para isso.)
 */

async function run<T>(fn: () => Promise<unknown>): Promise<{ data: T | null; error: AuthErr | null }> {
  try {
    const r = (await fn()) as { data?: T; error?: AuthErr | null } | T | null
    if (r && typeof r === 'object' && !Array.isArray(r) && 'error' in r) {
      const x = r as { data?: T; error?: AuthErr | null }
      return { data: (x.data ?? null) as T | null, error: x.error ?? null }
    }
    return { data: (r ?? null) as T | null, error: null }
  } catch (e) {
    return { data: null, error: (e as AuthErr) ?? { message: 'erro' } }
  }
}

const auth = () => neon?.auth.getBetterAuthInstance()

// ---------------------------------------------------------------- chamadas

/** a conta entra com senha? (quem entra só pelo Google não tem senha para trocar); null se não deu para saber */
export async function hasPasswordLogin(): Promise<boolean | null> {
  const a = auth()
  if (!a) return null
  const { data, error } = await run<{ providerId?: string; provider?: string }[]>(() => a.listAccounts())
  if (error || !Array.isArray(data)) return null
  return data.some((x) => (x.providerId ?? x.provider) === 'credential')
}

/** troca a senha; devolve a frase de erro ou null se deu certo. `signOutOthers` encerra os outros aparelhos */
export async function changePassword(current: string, next: string, signOutOthers: boolean): Promise<string | null> {
  const a = auth()
  if (!a) return 'No modo demonstração não há senha para trocar.'
  if (next.length < 8) return 'A nova senha precisa ter pelo menos 8 caracteres.'
  const { error } = await run(() => a.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: signOutOthers }))
  return error ? passwordErrorMessage(error) : null
}

/** aparelhos conectados (null se não deu para carregar) */
export async function listDevices(): Promise<Device[] | null> {
  const a = auth()
  if (!a) return null
  const [list, now] = await Promise.all([run<RawSession[]>(() => a.listSessions()), run<{ session?: { id?: string } }>(() => a.getSession())])
  if (list.error || !Array.isArray(list.data)) {
    console.warn('aparelhos: não foi possível listar as sessões', list.error ?? list.data)
    return null
  }
  return toDevices(list.data, now.data?.session?.id ?? null)
}

/** encerra um aparelho; devolve a frase de erro ou null */
export async function signOutDevice(token: string): Promise<string | null> {
  const a = auth()
  if (!a) return 'Indisponível neste ambiente.'
  const { error } = await run(() => a.revokeSession({ token }))
  return error ? 'Não foi possível encerrar esse aparelho agora. Tente novamente.' : null
}

/** encerra todos os aparelhos, menos o de agora */
export async function signOutOtherDevices(): Promise<string | null> {
  const a = auth()
  if (!a) return 'Indisponível neste ambiente.'
  const { error } = await run(() => a.revokeOtherSessions())
  return error ? 'Não foi possível encerrar os outros aparelhos agora. Tente novamente.' : null
}

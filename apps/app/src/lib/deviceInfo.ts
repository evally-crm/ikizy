/** partes puras da segurança da conta (mensagens, nome do aparelho, lista de sessões): sem rede, com teste. As chamadas ao login ficam em security.ts */

export type AuthErr = { message?: string; code?: string; status?: number }

/** erro do login -> frase para a pessoa */
export function passwordErrorMessage(error: AuthErr | null | undefined): string {
  const code = error?.code ?? ''
  const text = error?.message ?? ''
  // o adaptador do Neon traduz a senha atual errada para `invalid_credentials` (401, "Invalid email or password")
  if (code === 'INVALID_PASSWORD' || code === 'invalid_credentials' || /invalid (email or )?password/i.test(text)) return 'A senha atual não confere.'
  if (code === 'PASSWORD_TOO_SHORT' || code === 'weak_password' || /too short/i.test(text)) return 'A nova senha precisa ter pelo menos 8 caracteres.'
  if (code === 'PASSWORD_TOO_LONG' || /too long/i.test(text)) return 'A nova senha é longa demais.'
  if (error?.status === 429 || code === 'over_request_rate_limit') return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'
  return 'Não foi possível trocar a senha agora. Tente novamente.'
}

/** "Chrome no Windows", "Safari no iPhone": o suficiente para a pessoa reconhecer o aparelho */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? ''
  if (!ua) return 'Aparelho desconhecido'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Navegador'
  const system = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'Mac'
            : /Linux/.test(ua)
              ? 'Linux'
              : null
  return system ? `${browser} no ${system}` : browser
}

export interface Device {
  /** identifica a sessão para encerrar (nunca mostrar) */
  token: string
  label: string
  /** quando entrou neste aparelho */
  since: Date
  current: boolean
}

export interface RawSession {
  id: string
  token: string
  userAgent?: string | null
  createdAt: string | Date
}

/** sessões do servidor -> lista para a tela, com o aparelho de agora no topo e depois o mais recente primeiro.
 * O aparelho de agora se acha pelo `id` da sessão: o `token` que o app recebe em getSession() é um JWT, não o da lista. */
export function toDevices(sessions: RawSession[], currentId: string | null): Device[] {
  return sessions
    .map((s) => ({ token: s.token, label: describeDevice(s.userAgent), since: new Date(s.createdAt), current: s.id === currentId }))
    .sort((a, b) => Number(b.current) - Number(a.current) || b.since.getTime() - a.since.getTime())
}


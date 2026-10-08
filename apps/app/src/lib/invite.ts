import { ROUTES } from './routes'

/**
 * Convite pendente: quem abre /convite/<token> sem estar logada vai criar a conta ou entrar (e às vezes
 * confirmar o e-mail) antes de aceitar. O token fica guardado neste navegador para voltar ao convite depois.
 */
const KEY = 'ikizy:convite'
const TOKEN = /^[a-f0-9]{64}$/

export const isInviteToken = (v: unknown): v is string => typeof v === 'string' && TOKEN.test(v)

export function savePendingInvite(token: string) {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    /* navegador sem armazenamento: a pessoa abre o link de novo */
  }
}

export function pendingInvite(): string | null {
  try {
    const t = localStorage.getItem(KEY)
    return isInviteToken(t) ? t : null
  } catch {
    return null
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nada a fazer */
  }
}

export const invitePath = (token: string) => `${ROUTES.invite}/${token}`

/** para onde mandar quem está logada e ainda não tem negócio: convite pendente ou criação do negócio */
export const noSalonPath = () => {
  const t = pendingInvite()
  return t ? invitePath(t) : ROUTES.createSalon
}

/** link completo para mandar à pessoa convidada */
export const inviteUrl = (token: string) => `${window.location.origin}${invitePath(token)}`

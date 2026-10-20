import { invitePath, isInviteToken } from '../domain/team'
import { ROUTES } from './routes'

/**
 * Convite aberto antes de ter conta: o token fica guardado no aparelho enquanto a pessoa cria a conta,
 * confirma o e-mail ou entra com o Google. Sem negócio, ela volta para o convite em vez de cair no cadastro do salão.
 */
const KEY = 'ikizy:convite'

export function savePendingInvite(token: string) {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    // sem armazenamento: depois de entrar, é só abrir o link de novo
  }
}

export function readPendingInvite(): string | null {
  try {
    const token = localStorage.getItem(KEY)
    return isInviteToken(token) ? token : null
  } catch {
    return null
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nada a limpar
  }
}

/** para onde vai quem entrou e ainda não tem negócio: o convite pendente ou a criação do negócio */
export function noSalonPath(): string {
  const token = readPendingInvite()
  return token ? invitePath(token) : ROUTES.createSalon
}

import { ROLE_LABEL, type Role } from './roles'

export type InviteState = 'ok' | 'used' | 'revoked' | 'expired'

/** caminho da tela de aceitar (app.ikizy.com/convite/<token>) */
export const invitePath = (token: string) => `/convite/${token}`

/** só aceita o formato que o banco gera (64 caracteres hexadecimais): nada de texto solto vindo da URL */
export const isInviteToken = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)

/** por que o convite não vale mais, em português */
export function inviteStateText(state: InviteState): string | null {
  switch (state) {
    case 'used':
      return 'Este convite já foi usado. Se a conta é sua, é só entrar.'
    case 'revoked':
      return 'Este convite foi cancelado. Peça um novo para quem te convidou.'
    case 'expired':
      return 'Este convite venceu (vale 7 dias). Peça um novo para quem te convidou.'
    default:
      return null
  }
}

/** "vence em 3 dias", "vence hoje" */
export function expiresLabel(expiresAt: Date, now = new Date()): string {
  const days = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'vencido'
  if (days === 1) return 'vence em até 1 dia'
  return `vence em ${days} dias`
}

/** texto pronto para mandar no WhatsApp com o link */
export function inviteMessage({ salonName, role, name, url }: { salonName: string; role: Role; name?: string | null; url: string }): string {
  const hello = name ? `Oi, ${name.split(' ')[0]}!` : 'Oi!'
  const what = role === 'professional' ? 'ver sua agenda e suas clientes' : `entrar como ${ROLE_LABEL[role].toLowerCase()}`
  return `${hello} Este é o seu acesso ao IKIZY do ${salonName}, para ${what} pelo celular. É só abrir o link e criar sua conta (vale 7 dias): ${url}`
}

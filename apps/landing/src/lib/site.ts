/** endereço do sistema (app.ikizy.com). Em desenvolvimento, aponte com PUBLIC_APP_URL=http://localhost:5173 */
export const APP_URL = (import.meta.env.PUBLIC_APP_URL as string | undefined) ?? 'https://app.ikizy.com'

export const LINKS = {
  login: `${APP_URL}/login`,
  signup: `${APP_URL}/cadastro`,
} as const

export const CONTACT_EMAIL = 'contato@ikizy.com'

export const NAV = [
  { href: '/recursos', label: 'Recursos' },
  { href: '/precos', label: 'Preços' },
  { href: '/sobre', label: 'Sobre' },
  { href: '/contato', label: 'Contato' },
] as const

export const TAGLINE = 'Estética, elegância e autenticidade com a gestão mais simples para negócios de beleza.'

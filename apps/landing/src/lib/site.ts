/** endereço do sistema (app.ikizy.com). Em desenvolvimento, aponte com PUBLIC_APP_URL=http://localhost:5173 */
export const APP_URL = (import.meta.env.PUBLIC_APP_URL as string | undefined) ?? 'https://app.ikizy.com'

export const LINKS = {
  login: `${APP_URL}/login`,
  signup: `${APP_URL}/cadastro`,
} as const

export const CONTACT_EMAIL = 'contato@ikizy.com'

/** dados da empresa nos documentos legais (/privacidade e /termos); razão social conforme o cadastro do CNPJ */
export const COMPANY = {
  legalName: '64.800.845 Maria Eduarda Dias Ferreira',
  document: 'CNPJ 64.800.845/0001-44',
  updatedAt: '7 de outubro de 2026',
} as const

export const NAV = [
  { href: '/recursos', label: 'Recursos' },
  { href: '/precos', label: 'Preços' },
  { href: '/sobre', label: 'Sobre' },
  { href: '/contato', label: 'Contato' },
] as const

export const TAGLINE = 'Estética, elegância e autenticidade com a gestão mais simples para negócios de beleza.'

/** endereço do sistema (app.ikizy.com). Em desenvolvimento, aponte com PUBLIC_APP_URL=http://localhost:5173 */
export const APP_URL = (import.meta.env.PUBLIC_APP_URL as string | undefined) ?? 'https://app.ikizy.com'

export const LINKS = {
  login: `${APP_URL}/login`,
  signup: `${APP_URL}/cadastro`,
} as const

/** textos dos botões de cadastro: deixam claro que é gestão de negócio de beleza, simples e grátis para testar */
export const CTA = {
  main: 'Começar grátis',
  short: 'Teste grátis',
  hint: '30 dias grátis, sem cartão.',
} as const

export const CONTACT_EMAIL = 'contato@ikizy.com'

/** dados da empresa nos documentos legais (/privacidade e /termos); razão social conforme o cadastro do CNPJ */
export const COMPANY = {
  legalName: '64.800.845 Maria Eduarda Dias Ferreira',
  document: 'CNPJ 64.800.845/0001-44',
  updatedAt: '7 de outubro de 2026',
} as const

/** redes da IKIZY no rodapé, junto do contato: só aparecem as que têm endereço preenchido; `handle` é o que aparece escrito */
export const SOCIALS = [
  { id: 'instagram', label: 'Instagram', handle: '@ikizy.app', url: 'https://instagram.com/ikizy.app' },
  { id: 'tiktok', label: 'TikTok', handle: '', url: '' },
  { id: 'whatsapp', label: 'WhatsApp', handle: '', url: '' },
] as const

export const NAV = [
  { href: '/#recursos', label: 'Recursos' },
  { href: '/#como-funciona', label: 'Como funciona' },
  { href: '/#precos', label: 'Preços' },
  { href: '/#contato', label: 'Contato' },
] as const

export const TAGLINE = 'Estética, elegância e autenticidade com gestão simples e completa para negócios de beleza.'

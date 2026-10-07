/** domínio base: cada salão ganha seu-salao.ikizy.com */
export const SITE_DOMAIN = 'ikizy.com'

/** nomes reservados (precisam ficar iguais ao check da migration 20261007000000) */
export const RESERVED_SLUGS = [
  'www', 'app', 'api', 'admin', 'painel', 'dashboard', 'login', 'cadastro', 'mail', 'email', 'smtp',
  'suporte', 'ajuda', 'help', 'blog', 'status', 'docs', 'static', 'assets', 'cdn', 'ikizy', 'dev',
  'staging', 'test', 'teste', 'demo', 'precos', 'recursos', 'sobre', 'contato',
] as const

export const SLUG_PATTERN = '[a-z0-9]+(-[a-z0-9]+)*'

export const isReservedSlug = (slug: string) => (RESERVED_SLUGS as readonly string[]).includes(slug)

export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

/** endereço público do salão */
export const siteHost = (slug: string) => `${slug || 'seu-salao'}.${SITE_DOMAIN}`

/** mapa de rotas do sistema (app.ikizy.com) */
export const ROUTES = {
  login: '/login',
  signup: '/cadastro',
  verifyEmail: '/verificar-email',
  createSalon: '/cadastro/salao',
  choosePlan: '/cadastro/plano',
  recover: '/recuperar-senha',
  reset: '/redefinir-senha',
  dashboard: '/dashboard',
} as const

/** caminho dentro do dashboard: dash('/clientes') => '/dashboard/clientes' */
export const dash = (path = '') => `${ROUTES.dashboard}${path}`

/** agenda; `query` sem o "?": agenda('nova=1') => '/dashboard/agenda?nova=1' */
export const agenda = (query = '') => dash(query ? `/agenda?${query}` : '/agenda')

/** abre um pedido do site na agenda: ela vai até o dia e abre o atendimento */
export const requestLink = (id: string) => agenda(`pedido=${id}`)

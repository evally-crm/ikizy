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

/** a agenda é a tela inicial do sistema; `query` sem o "?": agenda('nova=1') => '/dashboard?nova=1' */
export const agenda = (query = '') => (query ? `${ROUTES.dashboard}?${query}` : ROUTES.dashboard)

/** abre um pedido do site na agenda: ela vai até o dia e abre o atendimento */
export const requestLink = (id: string) => agenda(`pedido=${id}`)

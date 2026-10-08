/** mapa de rotas do sistema (app.ikizy.com) */
export const ROUTES = {
  login: '/login',
  signup: '/cadastro',
  createSalon: '/cadastro/salao',
  recover: '/recuperar-senha',
  reset: '/redefinir-senha',
  dashboard: '/dashboard',
  invite: '/convite',
} as const

/** caminho dentro do dashboard: dash('/agenda') => '/dashboard/agenda' */
export const dash = (path = '') => `${ROUTES.dashboard}${path}`

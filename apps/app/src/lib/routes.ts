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

/** caminho dentro do dashboard: dash('/agenda') => '/dashboard/agenda' */
export const dash = (path = '') => `${ROUTES.dashboard}${path}`

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ROUTES } from '../lib/routes'
import { noSalonPath } from '../lib/pendingInvite'
import { useAuth } from './AuthProvider'
import { LogoWord } from '../components/BunnyMark'

/** protege as telas do sistema: exige login e um salão (no modo demo, libera tudo) */
export default function RequireSalon() {
  const { status } = useAuth()
  const { pathname, search } = useLocation()

  if (status === 'loading') {
    return (
      <div className="splash" role="status" aria-live="polite">
        <span className="splash__logo">
          <LogoWord />
        </span>
        <span className="sr-only">Carregando…</span>
      </div>
    )
  }
  // guarda para onde a pessoa ia (ex.: o link de um pedido): depois de entrar, volta para lá
  if (status === 'signed-out') return <Navigate to={ROUTES.login} replace state={{ from: `${pathname}${search}` }} />
  if (status === 'no-salon') return <Navigate to={noSalonPath()} replace />
  return <Outlet />
}

import { Navigate, Outlet } from 'react-router-dom'
import { noSalonPath } from '../lib/invite'
import { ROUTES } from '../lib/routes'
import { useAuth } from './AuthProvider'

/** protege as telas do sistema: exige login e um salão (no modo demo, libera tudo) */
export default function RequireSalon() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="splash" role="status" aria-live="polite">
        <span className="splash__logo">
          IKIZY<span className="logo__dot">.</span>
        </span>
        <span className="sr-only">Carregando…</span>
      </div>
    )
  }
  if (status === 'signed-out') return <Navigate to={ROUTES.login} replace />
  if (status === 'no-salon') return <Navigate to={noSalonPath()} replace />
  return <Outlet />
}

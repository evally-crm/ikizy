import { Navigate, Outlet } from 'react-router-dom'
import { roleAccess, type RoleAccess } from '../domain/team'
import { ROUTES } from '../lib/routes'
import { useAuth } from './AuthProvider'

/** telas que dependem do perfil (Meu site, Meu negócio, Assinatura...): quem não pode, volta para o início */
export default function RequireRole({ allow }: { allow: (access: RoleAccess) => boolean }) {
  const { salon } = useAuth()
  // modo demonstração (sem salão): libera tudo, como a dona
  if (salon && !allow(roleAccess(salon.role))) return <Navigate to={ROUTES.dashboard} replace />
  return <Outlet />
}

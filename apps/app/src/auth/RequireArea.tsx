import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { can, type Area } from '../lib/permissions'
import { ROUTES } from '../lib/routes'
import { useAuth } from './AuthProvider'

/** telas que dependem do papel (financeiro, site, equipe, assinatura): quem não pode ver volta ao início */
export default function RequireArea({ area, children }: { area: Area; children: ReactNode }) {
  const { salon } = useAuth()
  if (!can(salon?.role, area)) return <Navigate to={ROUTES.dashboard} replace />
  return <>{children}</>
}

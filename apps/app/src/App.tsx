import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import RequireSalon from './auth/RequireSalon'
import { AppContextMenu } from './components/AppContextMenu'
import AppShell from './components/layout/AppShell'
import { ROUTES } from './lib/routes'
import Agenda from './pages/Agenda'
import Assinatura from './pages/Assinatura'
import Cadastro from './pages/auth/Cadastro'
import EscolherPlano from './pages/auth/EscolherPlano'
import Login from './pages/auth/Login'
import Onboarding from './pages/auth/Onboarding'
import RecuperarSenha from './pages/auth/RecuperarSenha'
import RedefinirSenha from './pages/auth/RedefinirSenha'
import VerificarEmail from './pages/auth/VerificarEmail'
import Clientes from './pages/Clientes'
import Financeiro from './pages/Financeiro'
import MeuSite from './pages/MeuSite'

/**
 * app.ikizy.com: acesso (/login, /cadastro, /recuperar-senha) e sistema (/dashboard/*).
 * A agenda é a tela inicial (/dashboard); /dashboard/agenda continua valendo para links antigos.
 * Cadastro: /cadastro (e-mail e senha ou Google) > /verificar-email (código, só e-mail e senha) > /cadastro/salao (questionário) > /cadastro/plano > /dashboard
 */
/** links antigos /dashboard/agenda?... vão para a agenda na raiz, com os mesmos parâmetros */
function ToAgenda() {
  const { search } = useLocation()
  return <Navigate to={`${ROUTES.dashboard}${search}`} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="cadastro" element={<Cadastro />} />
        <Route path="verificar-email" element={<VerificarEmail />} />
        <Route path="cadastro/salao" element={<Onboarding />} />
        <Route path="cadastro/plano" element={<EscolherPlano />} />
        <Route path="recuperar-senha" element={<RecuperarSenha />} />
        <Route path="redefinir-senha" element={<RedefinirSenha />} />

        <Route path="dashboard" element={<RequireSalon />}>
          <Route element={<AppShell />}>
            <Route index element={<Agenda />} />
            <Route path="agenda" element={<ToAgenda />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<Clientes />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="site" element={<MeuSite />} />
            <Route path="assinatura" element={<Assinatura />} />
            <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
      <AppContextMenu />
    </AuthProvider>
  )
}

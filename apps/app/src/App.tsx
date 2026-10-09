import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import RequireSalon from './auth/RequireSalon'
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
import Clientes from './pages/Clientes'
import Dashboard from './pages/Dashboard'
import Financeiro from './pages/Financeiro'
import MeuSite from './pages/MeuSite'
import Placeholder from './pages/Placeholder'

/**
 * app.ikizy.com: acesso (/login, /cadastro, /recuperar-senha) e sistema (/dashboard/*).
 * Cadastro: /cadastro (e-mail e senha ou Google) > /cadastro/salao (questionário) > /cadastro/plano > /dashboard
 */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="cadastro" element={<Cadastro />} />
        <Route path="cadastro/salao" element={<Onboarding />} />
        <Route path="cadastro/plano" element={<EscolherPlano />} />
        <Route path="recuperar-senha" element={<RecuperarSenha />} />
        <Route path="redefinir-senha" element={<RedefinirSenha />} />

        <Route path="dashboard" element={<RequireSalon />}>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<Clientes />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="site" element={<MeuSite />} />
            <Route path="assinatura" element={<Assinatura />} />
            <Route path="*" element={<Placeholder />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
    </AuthProvider>
  )
}

import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import RequireArea from './auth/RequireArea'
import RequireSalon from './auth/RequireSalon'
import AppShell from './components/layout/AppShell'
import { ROUTES } from './lib/routes'
import Agenda from './pages/Agenda'
import Assinatura from './pages/Assinatura'
import Cadastro from './pages/auth/Cadastro'
import Convite from './pages/auth/Convite'
import Login from './pages/auth/Login'
import Onboarding from './pages/auth/Onboarding'
import RecuperarSenha from './pages/auth/RecuperarSenha'
import RedefinirSenha from './pages/auth/RedefinirSenha'
import Clientes from './pages/Clientes'
import Dashboard from './pages/Dashboard'
import Equipe from './pages/Equipe'
import Financeiro from './pages/Financeiro'
import MeuSite from './pages/MeuSite'
import Placeholder from './pages/Placeholder'

/** app.ikizy.com: acesso (/login, /cadastro, /recuperar-senha, /convite/:token) e sistema (/dashboard/*) */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="cadastro" element={<Cadastro />} />
        <Route path="cadastro/salao" element={<Onboarding />} />
        <Route path="recuperar-senha" element={<RecuperarSenha />} />
        <Route path="redefinir-senha" element={<RedefinirSenha />} />
        <Route path="convite/:token" element={<Convite />} />

        <Route path="dashboard" element={<RequireSalon />}>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<Clientes />} />
            <Route path="financeiro" element={<RequireArea area="finance"><Financeiro /></RequireArea>} />
            <Route path="site" element={<RequireArea area="site"><MeuSite /></RequireArea>} />
            <Route path="equipe" element={<RequireArea area="team"><Equipe /></RequireArea>} />
            <Route path="assinatura" element={<RequireArea area="billing"><Assinatura /></RequireArea>} />
            <Route path="*" element={<Placeholder />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
    </AuthProvider>
  )
}

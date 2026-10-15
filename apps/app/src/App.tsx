import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import RequireSalon from './auth/RequireSalon'
import { AppContextMenu } from './components/AppContextMenu'
import AppShell from './components/layout/AppShell'
import { ROUTES } from './lib/routes'
import Agenda from './pages/agenda'
import Assinatura from './pages/Assinatura'
import Cadastro from './pages/auth/Cadastro'
import Login from './pages/auth/Login'
import RecuperarSenha from './pages/auth/RecuperarSenha'
import RedefinirSenha from './pages/auth/RedefinirSenha'
import VerificarEmail from './pages/auth/VerificarEmail'
import Onboarding from './pages/cadastro'
import Plano from './pages/cadastro/Plano'
import Clientes from './pages/clientes'
import Financeiro from './pages/financeiro'
import MeuNegocio from './pages/meu-negocio'
import MeuSite from './pages/meu-site'

/**
 * app.ikizy.com: acesso (/login, /cadastro, /recuperar-senha) e sistema (/dashboard/*).
 * A agenda é a tela inicial (/dashboard); /dashboard/agenda continua valendo para links antigos.
 * Cadastro: /cadastro (e-mail e senha ou Google) > /verificar-email (código, só e-mail e senha) > /cadastro/salao (uma pergunta por tela, com o sistema se montando ao fundo) > /cadastro/plano > /dashboard
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
        <Route path="cadastro/plano" element={<Plano />} />
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
            <Route path="negocio" element={<MeuNegocio />} />
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

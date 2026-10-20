import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import RequireRole from './auth/RequireRole'
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
import Convite from './pages/convite'
import Financeiro from './pages/financeiro'
import Ganhos from './pages/ganhos'
import Inicio from './pages/inicio'
import MeuNegocio from './pages/meu-negocio'
import MeuSite from './pages/meu-site'

/**
 * app.ikizy.com: acesso (/login, /cadastro, /recuperar-senha) e sistema (/dashboard/*).
 * O Início é a tela inicial (/dashboard); a agenda fica em /dashboard/agenda.
 * Convite da equipe: /convite/<token> (cria a conta ou entra e liga o login ao negócio).
 * Telas por perfil (RequireRole): a profissional vê agenda, clientes e ganhos; a recepção, também o caixa de hoje.
 * Cadastro: /cadastro (e-mail e senha ou Google) > /verificar-email (código, só e-mail e senha) > /cadastro/salao (uma pergunta por tela, com o sistema se montando ao fundo) > /cadastro/plano > /dashboard
 */
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
        <Route path="convite/:token" element={<Convite />} />

        <Route path="dashboard" element={<RequireSalon />}>
          <Route element={<AppShell />}>
            <Route index element={<Inicio />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<Clientes />} />
            <Route element={<RequireRole allow={(a) => a.finance !== 'none'} />}>
              <Route path="financeiro" element={<Financeiro />} />
            </Route>
            <Route element={<RequireRole allow={(a) => a.earnings} />}>
              <Route path="ganhos" element={<Ganhos />} />
            </Route>
            <Route element={<RequireRole allow={(a) => a.site} />}>
              <Route path="site" element={<MeuSite />} />
            </Route>
            <Route element={<RequireRole allow={(a) => a.business} />}>
              <Route path="negocio" element={<MeuNegocio />} />
            </Route>
            <Route element={<RequireRole allow={(a) => a.billing} />}>
              <Route path="assinatura" element={<Assinatura />} />
            </Route>
            <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
      <AppContextMenu />
    </AuthProvider>
  )
}

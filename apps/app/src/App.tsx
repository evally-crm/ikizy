import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import RequireSalon from './auth/RequireSalon'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import Agenda from './pages/Agenda'
import Auth from './pages/Auth'
import Clientes from './pages/Clientes'
import Financeiro from './pages/Financeiro'
import MeuSite from './pages/MeuSite'
import Onboarding from './pages/Onboarding'
import Placeholder from './pages/Placeholder'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="entrar" element={<Auth />} />
        <Route path="comecar" element={<Onboarding />} />
        <Route element={<RequireSalon />}>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<Clientes />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="site" element={<MeuSite />} />
            <Route path="*" element={<Placeholder />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}

import { Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import Agenda from './pages/Agenda'
import Clientes from './pages/Clientes'
import Financeiro from './pages/Financeiro'
import MeuSite from './pages/MeuSite'
import Placeholder from './pages/Placeholder'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="clientes/:id" element={<Clientes />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="site" element={<MeuSite />} />
        <Route path="*" element={<Placeholder />} />
      </Route>
    </Routes>
  )
}

import { useLocation } from 'react-router-dom'
import { Hourglass } from 'lucide-react'
import { navItems } from '../components/layout/nav'
import { Card, Em } from '../components/ui'

export default function Placeholder() {
  const { pathname } = useLocation()
  const item = navItems.find((i) => i.to === pathname)

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <p className="eyebrow">Em construção</p>
          <h1 className="page__title">
            {item?.label ?? 'Página'} <Em>em breve</Em>.
          </h1>
        </div>
      </header>
      <Card className="empty">
        <Hourglass size={28} aria-hidden="true" />
        <p>Essa seção entra nas próximas fases do IKIZY.</p>
      </Card>
    </div>
  )
}

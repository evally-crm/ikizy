import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { roleAccess } from '../../domain/team'
import { Tabs } from '../../components/ui'
import { MonthView } from './MonthView'
import { TodayView } from './TodayView'

type View = 'hoje' | 'mes'

/** Financeiro: "Hoje" (caixa do dia) ou "Mês" (fechamento); a aba fica no endereço (?mes=1) para o voltar do navegador funcionar */
export default function Financeiro() {
  const { salon } = useAuth()
  const [params, setParams] = useSearchParams()
  // a recepção vê só o caixa de hoje: sem a aba do mês (fechamento, comissões e lucro)
  const onlyToday = roleAccess(salon?.role ?? 'owner').finance === 'today'
  const view: View = params.get('mes') && !onlyToday ? 'mes' : 'hoje'
  const tabs = (
    <Tabs
      label="Período"
      value={view}
      onChange={(v: View) => setParams(v === 'mes' ? { mes: '1' } : {}, { replace: true })}
      items={[
        { id: 'hoje', label: 'Hoje' },
        { id: 'mes', label: 'Mês' },
      ]}
    />
  )
  return view === 'hoje' ? <TodayView tabs={onlyToday ? null : tabs} /> : <MonthView tabs={tabs} />
}

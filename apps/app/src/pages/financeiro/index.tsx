import { useSearchParams } from 'react-router-dom'
import { Tabs } from '../../components/ui'
import { MonthView } from './MonthView'
import { TodayView } from './TodayView'

type View = 'hoje' | 'mes'

/** Financeiro: "Hoje" (caixa do dia) ou "Mês" (fechamento); a aba fica no endereço (?mes=1) para o voltar do navegador funcionar */
export default function Financeiro() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('mes') ? 'mes' : 'hoje'
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
  return view === 'hoje' ? <TodayView tabs={tabs} /> : <MonthView tabs={tabs} />
}

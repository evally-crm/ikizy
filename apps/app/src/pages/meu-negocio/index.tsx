import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useAgenda } from '../../data/AgendaProvider'
import { useBusiness } from '../../data/business'
import type { Product, Service } from '../../data/catalog'
import { openStatus, summarizeBusiness, summarizeHours } from '../../domain/business'
import { ConfirmDialog } from '../../components/Modal'
import { WorkingHoursDialog } from '../../components/WorkingHoursDialog'
import { Em, PageHeader, StatTile, Tabs } from '../../components/ui'
import { formatBRL } from '../../lib/format'
import { DetailsPanel } from './DetailsPanel'
import { HoursPanel } from './HoursPanel'
import { MaterialsPanel } from './MaterialsPanel'
import { ProductDialog } from './ProductDialog'
import { ServiceDialog } from './ServiceDialog'
import { ServicesPanel } from './ServicesPanel'
import './MeuNegocio.css'
import { PageLoader } from '../../components/PageLoader'

const TABS = [
  { id: 'dados', label: 'Dados' },
  { id: 'horario', label: 'Horário' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'custos', label: 'Materiais' },
] as const
type TabId = (typeof TABS)[number]['id']

/** /dashboard/negocio: tudo que é do negócio (dados, horário, serviços, materiais), uma seção por vez em abas */
export default function MeuNegocio() {
  const { salon } = useAuth()
  const { professionals, workingHours, reload: reloadAgenda } = useAgenda()
  const biz = useBusiness()
  const { hash, state } = useLocation()
  const navigate = useNavigate()
  const canManage = !salon || salon.role === 'owner' || salon.role === 'manager'
  // a aba fica no endereço (#servicos): os atalhos dos primeiros passos e o voltar do navegador funcionam
  const tab: TabId = TABS.find((t) => hash === '#' + t.id)?.id ?? 'dados'

  const [editingHours, setEditingHours] = useState(false)
  const [service, setService] = useState<Service | 'new' | null>(null)
  const [product, setProduct] = useState<Product | 'new' | null>(null)
  const [removing, setRemoving] = useState<{ kind: 'service' | 'product'; id: string; name: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // vindo dos primeiros passos (#horario), já abre a edição do horário; trocar de aba pelo menu não abre
  useEffect(() => {
    if (biz.loading || hash !== '#horario' || !canManage) return
    if (!(state as { tab?: boolean } | null)?.tab) setEditingHours(true)
  }, [hash, state, biz.loading, canManage])

  const summary = useMemo(() => summarizeBusiness(biz.services, biz.products), [biz.services, biz.products])
  const allHours = useMemo(() => professionals.flatMap((p) => workingHours[p.id] ?? []), [professionals, workingHours])
  const [now] = useState(() => new Date())
  const status = useMemo(() => openStatus(allHours, now), [allHours, now])
  const weekText = summarizeHours(allHours)[0] ?? 'Horário ainda não definido'

  // a agenda guarda a lista de serviços para marcar horário: atualiza depois de mexer aqui
  const afterServices = (message: string | null, ok: string) => {
    if (!message) {
      reloadAgenda()
      setToast(ok)
    }
    return message
  }

  const confirmRemoval = async () => {
    if (!removing) return
    const r = removing
    setRemoving(null)
    setService(null)
    setProduct(null)
    const message = r.kind === 'service' ? afterServices(await biz.removeService(r.id), 'Serviço apagado') : await biz.removeProduct(r.id)
    if (message) setToast(message)
    else if (r.kind === 'product') setToast('Material apagado')
  }

  return (
    <div className="page bizpage">
      <PageHeader
        title={
          <>
            Meu <Em>negócio</Em>
          </>
        }
        crumb={weekText}
        actions={
          <Tabs
            label="Seções do negócio"
            value={tab}
            onChange={(id: TabId) => navigate({ hash: '#' + id }, { replace: true, state: { tab: true } })}
            items={TABS.map((t) => ({
              id: t.id,
              label: t.label,
              badge: t.id === 'servicos' ? summary.serviceCount || null : t.id === 'custos' ? biz.products.length || null : null,
            }))}
          />
        }
      />

      {biz.error && (
        <p className="dialog__error" role="alert">
          {biz.error}{' '}
          <button type="button" className="textlink" onClick={biz.reload}>
            Tentar de novo
          </button>
        </p>
      )}
      {!canManage && <p className="alert">Só a dona ou a gerente alteram os dados do negócio. Você pode consultar.</p>}

      {biz.loading ? (
        <PageLoader label="Carregando os dados do negócio…" />
      ) : (
        <>
          <div className="biztiles">
            <StatTile
              label="Serviços"
              value={summary.serviceCount}
              hint={summary.unpriced > 0 ? `${summary.unpriced} ${summary.unpriced === 1 ? 'sem preço' : 'sem preço'}` : 'Todos com preço'}
            />
            <StatTile
              label="Sobra média"
              value={summary.averageMarginPct === null ? '–' : `${summary.averageMarginPct}%`}
              hint={summary.averageMarginPct === null ? 'Ligue um material a um serviço' : 'dos serviços com material'}
            />
            <StatTile label="Material por mês" value={formatBRL(summary.materialSpend).replace(',00', '')} hint={`${biz.products.length} materiais`} />
            <StatTile label="Equipe" value={professionals.length} hint={status.open ? 'Aberto agora' : 'Fechado agora'} />
          </div>

          {tab === 'dados' && <DetailsPanel details={biz.details} canManage={canManage} status={status} onSave={biz.saveDetails} />}
          {tab === 'horario' && (
            <HoursPanel professionals={professionals} workingHours={workingHours} canManage={canManage} onEdit={() => setEditingHours(true)} />
          )}
          {tab === 'servicos' && (
            <ServicesPanel services={biz.services} products={biz.products} canManage={canManage} onNew={() => setService('new')} onOpen={setService} />
          )}
          {tab === 'custos' && (
            <MaterialsPanel
              products={biz.products}
              services={biz.services}
              total={summary.materialSpend}
              canManage={canManage}
              onNew={() => setProduct('new')}
              onOpen={setProduct}
            />
          )}
        </>
      )}

      {editingHours && <WorkingHoursDialog onClose={() => setEditingHours(false)} notify={setToast} />}
      {service && (
        <ServiceDialog
          service={service === 'new' ? null : service}
          products={biz.products}
          onClose={() => setService(null)}
          onSave={async (input) =>
            afterServices(await biz.saveService(input, service === 'new' ? undefined : service.id), service === 'new' ? 'Serviço criado' : 'Serviço salvo')
          }
          onRemove={service === 'new' ? undefined : () => setRemoving({ kind: 'service', id: service.id, name: service.name })}
        />
      )}
      {product && (
        <ProductDialog
          product={product === 'new' ? null : product}
          onClose={() => setProduct(null)}
          onSave={async (input) => {
            const message = await biz.saveProduct(input, product === 'new' ? undefined : product.id)
            if (!message) setToast('Material salvo')
            return message
          }}
          onRemove={product === 'new' ? undefined : () => setRemoving({ kind: 'product', id: product.id, name: product.name })}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Apagar ${removing.name}?`}
          text={
            removing.kind === 'service'
              ? 'O serviço sai da agenda e do site. Os atendimentos já feitos continuam no histórico com o nome dele.'
              : 'Os serviços que usavam este material ficam sem custo de material.'
          }
          confirmLabel="Apagar"
          onClose={() => setRemoving(null)}
          onConfirm={() => void confirmRemoval()}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

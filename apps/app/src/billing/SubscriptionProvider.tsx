import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { isNeonConfigured, neon } from '../lib/neon'
import { accessState, parseSubscription, type AccessState, type SubscriptionInfo } from '../lib/plans'

interface SubscriptionState {
  sub: SubscriptionInfo | null
  state: AccessState
  loading: boolean
  refresh: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionState | null>(null)

export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription precisa estar dentro de <SubscriptionProvider>')
  return ctx
}

const DAY = 24 * 60 * 60 * 1000

/** modo demonstração (sem Neon): um teste do Solo com 21 dias restantes */
const demoSubscription = (): SubscriptionInfo => ({
  plan: 'solo',
  status: 'trialing',
  trialEndsAt: new Date(Date.now() + 21 * DAY),
  accessUntil: new Date(Date.now() + 21 * DAY),
  method: null,
  cancelAtPeriodEnd: false,
  hasCustomer: false,
  planChosen: true,
})

/** carrega a assinatura do salão (só leitura: quem grava é o webhook do Stripe no servidor) */
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { salon } = useAuth()
  const salonId = salon?.id
  const [sub, setSub] = useState<SubscriptionInfo | null>(() => (isNeonConfigured ? null : demoSubscription()))
  const [loading, setLoading] = useState(isNeonConfigured)

  const load = useCallback(async () => {
    if (!neon || !salonId) return
    const { data, error } = await neon.from('subscriptions').select('*').eq('salon_id', salonId).maybeSingle()
    setSub(!error && data ? parseSubscription(data as Record<string, unknown>) : null)
    setLoading(false)
  }, [salonId])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo<SubscriptionState>(
    () => ({
      sub,
      state: sub ? accessState(sub) : 'unknown',
      loading,
      refresh: load,
    }),
    [sub, loading, load],
  )

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}

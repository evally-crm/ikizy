/**
 * Prepara o Stripe para a IKIZY (idempotente: pode rodar de novo sem duplicar nada).
 *
 *   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup -w @ikizy/app
 *   ... -- --webhook https://app.ikizy.com/api/stripe/webhook     (cria também o webhook)
 *   ... -- --dry-run                                              (só mostra o que faria, sem chave)
 *
 * Cria: um produto + preço mensal em BRL por plano (identificados por lookup_key) e a configuração do
 * portal do cliente (trocar cartão, mudar de plano, cancelar). A chave nunca é gravada em arquivo.
 */
import Stripe from 'stripe'
import { PLAN_IDS, PLANS, priceLookupKey } from '../src/lib/plans.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const allowLive = args.includes('--live')
const webhookUrl = args.includes('--webhook') ? args[args.indexOf('--webhook') + 1] : undefined

const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const satisfies Stripe.WebhookEndpointCreateParams.EnabledEvent[]

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`

async function main() {
  if (dryRun) {
    console.log('Modo simulação (nenhuma chamada ao Stripe).\n')
    for (const id of PLAN_IDS) console.log(`  plano ${PLANS[id].name}: ${brl(PLANS[id].cents)}/mês  lookup_key=${priceLookupKey(id)}`)
    console.log('  portal do cliente: cancelar no fim do período, trocar cartão, mudar de plano, faturas')
    if (webhookUrl) console.log(`  webhook: ${webhookUrl}\n    eventos: ${WEBHOOK_EVENTS.join(', ')}`)
    return
  }

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Defina STRIPE_SECRET_KEY na sua sessão do terminal (não grave em arquivo).')
  const live = key.startsWith('sk_live_') || key.startsWith('rk_live_')
  if (live && !allowLive) {
    throw new Error('Esta é uma chave de PRODUÇÃO. Teste primeiro com sk_test_... ou rode de novo com --live se tiver certeza.')
  }
  console.log(`Modo ${live ? 'PRODUÇÃO' : 'teste'}\n`)
  const stripe = new Stripe(key)

  const priceIds: string[] = []
  let productId = ''
  const productIds: Record<string, string> = {}

  for (const id of PLAN_IDS) {
    const plan = PLANS[id]
    const lookup = priceLookupKey(id)
    const found = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1, expand: ['data.product'] })
    const existing = found.data[0]

    if (existing && existing.unit_amount === plan.cents && existing.currency === 'brl') {
      console.log(`✓ ${plan.name}: preço ${existing.id} já existe (${brl(plan.cents)}/mês)`)
      priceIds.push(existing.id)
      productId = typeof existing.product === 'string' ? existing.product : existing.product.id
      productIds[id] = productId
      continue
    }

    // preços do Stripe não mudam de valor: cria um novo e passa a lookup_key para ele
    const product = existing
      ? typeof existing.product === 'string'
        ? existing.product
        : existing.product.id
      : (await stripe.products.create({ name: `IKIZY ${plan.name}`, description: plan.audience, metadata: { plan: id } })).id
    const price = await stripe.prices.create({
      product,
      currency: 'brl',
      unit_amount: plan.cents,
      recurring: { interval: 'month' },
      lookup_key: lookup,
      transfer_lookup_key: true,
      metadata: { plan: id },
    })
    console.log(`+ ${plan.name}: preço ${price.id} criado (${brl(plan.cents)}/mês)${existing ? ' (substituiu o valor antigo)' : ''}`)
    priceIds.push(price.id)
    productIds[id] = product
  }

  // portal do cliente
  const configs = await stripe.billingPortal.configurations.list({ limit: 20 })
  let portal = configs.data.find((c) => c.metadata?.app === 'ikizy' && c.active)
  if (portal) {
    console.log(`✓ Portal do cliente: ${portal.id} já existe`)
  } else {
    portal = await stripe.billingPortal.configurations.create({
      metadata: { app: 'ikizy' },
      business_profile: { headline: 'IKIZY · gerencie sua assinatura' },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ['email', 'name'] },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'create_prorations',
          products: PLAN_IDS.map((id, i) => ({ product: productIds[id], prices: [priceIds[i]] })),
        },
      },
    })
    console.log(`+ Portal do cliente: ${portal.id} criado`)
  }

  // webhook (o segredo só aparece na criação)
  let webhookSecret: string | undefined
  if (webhookUrl) {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
    if (endpoints.data.some((e) => e.url === webhookUrl)) {
      console.log(`✓ Webhook ${webhookUrl} já existe (o segredo não pode ser lido de novo; veja no painel do Stripe)`)
    } else {
      const endpoint = await stripe.webhookEndpoints.create({ url: webhookUrl, enabled_events: [...WEBHOOK_EVENTS] })
      webhookSecret = endpoint.secret
      console.log(`+ Webhook ${webhookUrl} criado`)
    }
  }

  console.log('\nPróximos passos (variáveis de ambiente do projeto ikizy-app na Vercel):')
  console.log(`  STRIPE_PORTAL_CONFIGURATION = ${portal.id}`)
  if (webhookSecret) console.log(`  STRIPE_WEBHOOK_SECRET       = ${webhookSecret}   (copie agora; não aparece de novo)`)
  else console.log('  STRIPE_WEBHOOK_SECRET       = (segredo do endpoint, no painel do Stripe > Webhooks)')
  console.log('  STRIPE_SECRET_KEY, DATABASE_URL, NEON_AUTH_BASE_URL, APP_URL  (veja apps/app/.env.example)')
  console.log('\nNo painel do Stripe, ative Pix em Configurações > Formas de pagamento.')
}

main().catch((e) => {
  console.error(`\nErro: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})

import { expect, test } from '@playwright/test'
import { renderSitePage } from '../api/_lib/siteHtml.ts'

/**
 * página pública do negócio, gerada pelo mesmo código do servidor, com o agendamento online.
 * A API de agendamento é simulada: o teste confere o que a página manda para ela.
 */
const SERVICE = '11111111-1111-4111-8111-111111111111'
const PRO = '22222222-2222-4222-8222-222222222222'

const html = renderSitePage(
  {
    name: 'Studio Teste',
    slug: 'studio-teste',
    settings: { whatsapp: '(11) 98765-0000', show_prices: true, online_booking: true, palette: 'vinho-preto', tagline: 'Unhas com carinho' },
    services: [{ id: SERVICE, name: 'Alongamento em gel', category: 'Unhas', duration: 120, price: 220 }],
    professionals: [{ id: PRO, name: 'Maria' }],
    plans: [],
    team: [],
  } as never,
  { canonical: 'https://studio-teste.ikizy.com' },
)

test.beforeEach(async ({ page }) => {
  await page.route('https://studio-teste.ikizy.com/', (route) => route.fulfill({ contentType: 'text/html', body: html }))
  await page.route('https://studio-teste.ikizy.com/api/booking?**', (route) =>
    route.fulfill({ json: { slots: [{ professional_id: PRO, professional: 'Maria', minute: 600 }, { professional_id: PRO, professional: 'Maria', minute: 660 }] } }),
  )
  // fontes e o resto da internet ficam de fora
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort())
})

test('a página abre sem rolagem lateral e mostra os serviços', async ({ page }) => {
  await page.goto('https://studio-teste.ikizy.com/')
  await expect(page.getByText('Studio Teste').first()).toBeVisible()
  await expect(page.getByText('Alongamento em gel').first()).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('a cliente pede um horário e só consegue enviar autorizando o uso dos dados', async ({ page }) => {
  let sent: Record<string, unknown> | null = null
  await page.route('https://studio-teste.ikizy.com/api/booking', async (route) => {
    sent = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 201,
      json: { booking: { id: 'b1', starts_at: new Date().toISOString(), service: 'Alongamento em gel', professional: 'Maria', price: 220, duration: 120 } },
    })
  })

  await page.goto('https://studio-teste.ikizy.com/')
  await page.getByRole('button', { name: /Agendar/ }).first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  const service = sheet.getByRole('button', { name: /Alongamento em gel/ })
  if (await service.isVisible()) await service.click()
  await sheet.getByRole('button', { name: '10:00' }).click()
  await sheet.getByRole('button', { name: 'Continuar' }).click()

  await sheet.getByLabel('Seu nome').fill('Ana Souza')
  await sheet.getByLabel('Seu WhatsApp (com DDD)').fill('(11) 99999-8888')
  await sheet.getByRole('button', { name: 'Pedir horário' }).click()
  await expect(sheet.getByRole('alert')).toContainText('autorização')
  expect(sent).toBeNull()

  await sheet.getByRole('checkbox', { name: /Autorizo Studio Teste/ }).check()
  await sheet.getByRole('button', { name: 'Pedir horário' }).click()
  await expect(sheet.getByText('Pedido enviado')).toBeVisible()
  expect(sent).toMatchObject({ slug: 'studio-teste', service: SERVICE, minute: 600, name: 'Ana Souza', phone: '11999998888', consent: true })
})

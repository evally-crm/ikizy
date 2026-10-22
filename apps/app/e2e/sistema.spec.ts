import { expect, test, type Page } from '@playwright/test'

/**
 * vai para outra tela pelo menu do app. No modo demonstração o que se cria fica só na memória:
 * recarregar a página (page.goto) apagaria o que o teste acabou de fazer
 */
async function openFromMenu(page: Page, name: string) {
  await page.getByRole('link', { name, exact: true }).first().click()
}

/**
 * relógio fixo em hoje, 10h de Brasília: a demonstração tem um dia fixo de atendimentos (o pedido do site é às 17h),
 * então sem isso o resultado mudaria conforme a hora em que o teste roda
 */
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const NOW = new Date(`${today}T10:00:00-03:00`)

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW)
})

/** nada de rolagem lateral (regra da casa): a página cabe na largura da tela */
async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'a página rola para o lado').toBeLessThanOrEqual(1)
}

test.describe('telas principais', () => {
  for (const [path, heading] of [
    ['/dashboard', /Olá,/],
    ['/dashboard/agenda', 'Agenda'],
    ['/dashboard/clientes', 'Seus contatos'],
    ['/dashboard/financeiro', /./],
  ] as const) {
    test(`${path} abre sem erro e sem rolagem lateral`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading }).first()).toBeVisible()
      await expectNoSideScroll(page)
      expect(errors).toEqual([])
    })
  }
})

test('agendar um horário novo para amanhã', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Agendar horário' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo agendamento' })
  await expect(dialog).toBeVisible()

  await dialog.getByRole('combobox', { name: 'Nome da cliente' }).fill('Cliente Teste E2E')
  // amanhã: o botão logo depois do dia marcado (hoje); se hoje for o último da semana, passa a semana
  const days = dialog.getByRole('group', { name: 'Dia do atendimento' }).getByRole('button')
  const todayIndex = await days.evaluateAll((list) => list.findIndex((b) => b.getAttribute('aria-pressed') === 'true'))
  if (todayIndex === 6) {
    await dialog.getByRole('button', { name: 'Próxima semana' }).click()
    await days.first().click()
  } else {
    await days.nth(todayIndex + 1).click()
  }
  const firstFree = dialog.getByRole('button', { name: /^\d{2}:\d{2}$/ }).and(page.locator(':not([disabled])')).first()
  const time = (await firstFree.textContent())?.trim()
  await firstFree.click()
  await dialog.getByRole('button', { name: /^(Agendar|Salvar|Confirmar)/ }).last().click()

  await expect(dialog).toBeHidden()
  await openFromMenu(page, 'Agenda')
  // o atendimento aparece no dia escolhido
  const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000)
  const label = tomorrow.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })
  if (await page.getByRole('region', { name: 'Calendário' }).getByRole('tab').first().isVisible()) {
    // celular: semana em abas
    const tab = page.getByRole('tab', { name: new RegExp(`^${label}`) })
    if (!(await tab.isVisible())) await page.getByRole('button', { name: 'Próxima semana' }).first().click()
    await tab.click()
  } else {
    // computador: mês inteiro
    const dayMonth = tomorrow.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })
    const cell = page.getByRole('button', { name: new RegExp(`^${dayMonth}`) })
    if (!(await cell.isVisible())) await page.getByRole('button', { name: 'Próximo mês' }).click()
    await cell.click()
  }
  const day = page.getByRole('region', { name: 'Atendimentos do dia' })
  await expect(day.getByText('Cliente Teste E2E').first()).toBeVisible()
  if (time) await expect(day.getByText(time).first()).toBeVisible()
})

test('confirmar o pedido que chegou pelo site', async ({ page }) => {
  await page.goto('/dashboard')
  const requests = page.getByRole('region', { name: 'Pedidos do site para confirmar' })
  await expect(requests).toBeVisible()
  const bell = page.getByRole('button', { name: /^Pedidos do site:/ })
  const count = async () => Number((await bell.getAttribute('aria-label'))?.match(/(\d+) pedido/)?.[1] ?? 0)
  const before = await count()
  expect(before).toBeGreaterThan(0)
  await requests.getByRole('button', { name: 'Confirmar', exact: true }).first().click()
  // o sininho conta um pedido a menos (e some quando não sobra nenhum)
  if (before === 1) await expect(bell).toBeHidden()
  else await expect.poll(count).toBe(before - 1)
})

test('cadastrar uma cliente e achar na busca', async ({ page }) => {
  await page.goto('/dashboard/clientes')
  await page.getByRole('button', { name: 'Nova cliente' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova cliente' })
  await dialog.getByRole('textbox', { name: 'Nome' }).fill('Paula Teste')
  await dialog.getByRole('textbox', { name: 'WhatsApp' }).fill('11912345678')
  await dialog.getByRole('button', { name: 'Salvar' }).click()
  await expect(dialog).toBeHidden()

  // celular: abre a ficha dela; volta para a lista pelo menu
  if (!(await page.getByRole('searchbox', { name: 'Buscar cliente' }).isVisible())) await openFromMenu(page, 'Clientes')
  await page.getByRole('searchbox', { name: 'Buscar cliente' }).fill('Paula')
  await expect(page.getByRole('link', { name: /Paula Teste/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Marina Costa/ })).toBeHidden()
})

test('editor do site mostra a prévia com o nome do negócio', async ({ page }) => {
  await page.goto('/dashboard/site')
  await expect(page.getByRole('heading', { name: 'Meu site' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Página' })).toHaveAttribute('aria-selected', 'true')
  const preview = page.getByRole('button', { name: 'Prévia' })
  if (await preview.isVisible()) await preview.click()
  await expect(page.frameLocator('iframe').first().getByText('Studio Maria Beauty').first()).toBeVisible()
})

import { expect, test, type Page } from '@playwright/test'

/**
 * processos por tela, no modo demonstração (sem banco; nada é gravado):
 * Início, Clientes, Meu site, Meu negócio e Assinatura. A agenda e o pedido do site ficam em sistema.spec.ts.
 */
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const NOW = new Date(`${today}T10:00:00-03:00`)

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW)
})

/** erros de script durante o teste (a tela não pode quebrar) */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'a página rola para o lado').toBeLessThanOrEqual(1)
}

/** HTML da prévia do site (o iframe da prévia usa srcdoc) */
async function previewHtml(page: Page) {
  const preview = page.getByRole('button', { name: 'Prévia', exact: true })
  const opened = await preview.isVisible()
  if (opened) await preview.click()
  const html = (await page.locator('iframe[title="Prévia do seu site"]').first().getAttribute('srcdoc')) ?? ''
  // celular: a prévia abre por cima do editor; fecha para poder mexer nos campos de novo
  if (opened) {
    await page.keyboard.press('Escape')
    await expect(page.locator('iframe[title="Prévia do seu site"]').first()).toBeHidden()
  }
  return html
}

test.describe('Início', () => {
  test('abre a janela de novo agendamento e fecha sem criar nada', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Agendar horário' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo agendamento' })
    await expect(dialog).toBeVisible()
    // a profissional e o serviço já vêm escolhidos, e os horários livres aparecem
    await expect(dialog.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    expect(errors).toEqual([])
  })
})

test.describe('Clientes', () => {
  test('filtros da lista e ficha da cliente', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/dashboard/clientes')
    await expect(page.getByRole('heading', { level: 1, name: 'Seus contatos' })).toBeVisible()
    const all = page.getByRole('link', { name: /Marina Costa/ })
    await expect(all).toBeVisible()
    // um filtro por vez: "Sumidas" tira quem veio há pouco, "Todas" traz de volta
    for (const name of ['VIP', 'Sumidas', 'Novas', 'Aniversário', 'Chamar hoje']) {
      await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
      await expectNoSideScroll(page)
    }
    await page.getByRole('button', { name: /^Todas/ }).click()
    await all.click()
    await expect(page.getByText(/Cliente desde/).first()).toBeVisible()
    expect(errors).toEqual([])
  })
})

test.describe('Meu site', () => {
  test('trocar a paleta muda as cores da prévia, inclusive a estampa', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/dashboard/site')
    const nav = page.getByRole('navigation', { name: 'Partes do site' })
    await nav.getByRole('button', { name: /^Visual/ }).first().click()
    await page.getByRole('radio', { name: 'Rosa', exact: true }).check({ force: true })
    const html = await previewHtml(page)
    expect(html).toContain('--accent:#e52877')
    expect(html).not.toContain('--accent:#930500')
    expect(errors).toEqual([])
  })

  test('o botão do site segue o agendamento online: Agendar ligado, WhatsApp desligado', async ({ page }) => {
    await page.goto('/dashboard/site')
    const nav = page.getByRole('navigation', { name: 'Partes do site' })
    await nav.getByRole('button', { name: /Agenda/ }).first().click()
    const toggle = page.getByRole('switch', { name: /Aceitar agendamentos pelo site/ })
    await toggle.uncheck({ force: true })
    const off = await previewHtml(page)
    expect(off).not.toContain('class="btn card__cta" data-book')
    await toggle.check({ force: true })
    const on = await previewHtml(page)
    expect(on).toContain('class="btn card__cta" data-book')
  })
})

test.describe('Meu negócio', () => {
  test('todas as abas abrem sem erro', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/dashboard/negocio')
    for (const name of ['Dados', 'Horário', 'Serviços', 'Materiais', 'Equipe']) {
      await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click()
      await expectNoSideScroll(page)
    }
    expect(errors).toEqual([])
  })

  test('definir o horário de atendimento e salvar', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/dashboard/negocio')
    await page.getByRole('tab', { name: /^Horário/ }).click()
    await page.getByRole('button', { name: 'Editar horário' }).click()
    const dialog = page.getByRole('dialog', { name: 'Horário de atendimento' })
    await expect(dialog).toBeVisible()
    // a profissional aparece e há dias para ligar (o bug de abrir a janela sem profissional)
    const days = dialog.getByRole('switch')
    await expect(days.first()).toBeVisible()
    const closed = dialog.locator('.hours__row:not(.is-open)').first()
    if (await closed.count()) await closed.getByRole('switch').check({ force: true })
    const save = dialog.getByRole('button', { name: 'Salvar horários' })
    await expect(save).toBeEnabled()
    await save.click()
    await expect(dialog).toBeHidden()
    expect(errors).toEqual([])
  })

  test('a janela de horários abre direto pelo link da lista de primeiros passos', async ({ page }) => {
    await page.goto('/dashboard/negocio#horario')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expectNoSideScroll(page)
  })
})

test.describe('Assinatura', () => {
  test('mostra os planos sem erro', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/dashboard/assinatura')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.getByText(/R\$ ?19,90/).first()).toBeVisible()
    await expectNoSideScroll(page)
    expect(errors).toEqual([])
  })
})

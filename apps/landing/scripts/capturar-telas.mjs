/**
 * Tira os prints da seção "Como funciona" da landing a partir do app em modo demonstração.
 * Antes: suba o app sem Neon (config "ikizy-app-demo", porta 5188).
 * Uso: node apps/landing/scripts/capturar-telas.mjs [url-base]
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const base = process.argv[2] ?? 'http://localhost:5188'
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/telas')

const telas = [
  { nome: 'inicio', rota: '/dashboard' },
  { nome: 'agenda', rota: '/dashboard/agenda' },
  { nome: 'clientes', rota: '/dashboard/clientes' },
  { nome: 'financeiro', rota: '/dashboard/financeiro?mes=1' },
  { nome: 'site', rota: '/dashboard/site' },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, locale: 'pt-BR' })

for (const { nome, rota, antes } of telas) {
  await page.goto(base + rota, { waitUntil: 'load' })
  await page.waitForSelector('main', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  // painel de primeiros passos e animações não entram no print
  await page.addStyleTag({ content: '.setup{display:none!important} *,*::before,*::after{animation-duration:0s!important;transition:none!important;caret-color:transparent!important}' })
  if (antes) await antes(page)
  await page.waitForTimeout(800)
  const png = await page.screenshot()
  await sharp(png).webp({ quality: 86 }).toFile(path.join(out, `${nome}.webp`))
  console.log('ok', nome)
}

await browser.close()

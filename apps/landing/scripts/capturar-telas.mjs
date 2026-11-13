/**
 * Tira os prints do app em modo demonstração:
 *   public/telas/*.webp     seção "Como funciona" da landing (sem o painel de primeiros passos)
 *   public/email/tela-*.jpg e-mail de boas-vindas (o de Início com o painel, que o passo 3 cita)
 * Antes: suba o app sem Neon (config "ikizy-app-demo", porta 5188).
 * Uso: node apps/landing/scripts/capturar-telas.mjs [url-base]
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const base = process.argv[2] ?? 'http://localhost:5188'
const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public')

/** email: nome do jpg do e-mail; painel: mostra o painel de primeiros passos */
const telas = [
  { nome: 'inicio', rota: '/dashboard' },
  { nome: 'agenda', rota: '/dashboard/agenda', email: 'agenda' },
  { nome: 'clientes', rota: '/dashboard/clientes' },
  { nome: 'financeiro', rota: '/dashboard/financeiro?mes=1' },
  { nome: 'site', rota: '/dashboard/site', email: 'site' },
  { rota: '/dashboard', email: 'inicio', painel: true },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, locale: 'pt-BR' })
const calmo = '*,*::before,*::after{animation-duration:0s!important;transition:none!important;caret-color:transparent!important}'

for (const { nome, rota, email, painel } of telas) {
  await page.goto(base + rota, { waitUntil: 'load' })
  await page.waitForSelector('main', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.addStyleTag({ content: calmo + (painel ? '' : '.setup{display:none!important}') })
  await page.waitForTimeout(800)
  const png = await page.screenshot()
  if (nome) await sharp(png).webp({ quality: 86 }).toFile(path.join(pub, 'telas', `${nome}.webp`))
  if (email) await sharp(png).resize({ width: 1040 }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(pub, 'email', `tela-${email}.jpg`))
  console.log('ok', nome ?? '', email ? `email:${email}` : '')
}

await browser.close()

/**
 * gera as imagens dos e-mails em public/email/ (servidas em https://ikizy.com/email/...), porque e-mail não roda canvas nem SVG:
 *   coelho.png        o coelho de símbolos da landing (src/lib/pixelArt.ts), branco sobre vinho, com a boca rosa
 *   logo-coelho.png   o coelho da logo, branco, para o rodapé
 *   instagram.png     ícone do Instagram, branco
 *   tela-*.jpg        telas do sistema para o e-mail de boas-vindas
 * Uso: npx tsx scripts/email-arte.ts
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bunnyField, paintField } from '../src/lib/pixelArt.ts'

const dir = fileURLToPath(new URL('../public/email/', import.meta.url))
const telas = fileURLToPath(new URL('../public/telas/', import.meta.url))
mkdirSync(dir, { recursive: true })
const WINE = '#63001f'
const PINK = '#e0b8be'

// ---- coelho de símbolos: um contexto de mentira que anota os traços em SVG
const W = 200
const H = 300
const STEP = 4
const parts: string[] = []
let fill = '#fff'
let pen: string[] = []
const ctx = {
  lineWidth: 0,
  set fillStyle(v: string) { fill = v },
  set strokeStyle(_v: string) {},
  fillRect: (x: number, y: number, w: number, h: number) => void parts.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${fill}"/>`),
  beginPath: () => void (pen = []),
  moveTo: (x: number, y: number) => void pen.push(`M${x.toFixed(2)} ${y.toFixed(2)}`),
  lineTo: (x: number, y: number) => void pen.push(`L${x.toFixed(2)} ${y.toFixed(2)}`),
  stroke: () => void parts.push(`<path d="${pen.join('')}" fill="none" stroke="#fff" stroke-width="${(STEP * 0.2).toFixed(2)}"/>`),
}
const frame = { width: W, height: H, t: 2.2, step: STEP }
paintField(ctx as never, bunnyField(frame, { accent: true }), frame, '#fff', PINK)
const bunnySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${WINE}"/>${parts.join('')}</svg>`
const coelho = await sharp(Buffer.from(bunnySvg)).png({ palette: true, colors: 8 }).toBuffer()
writeFileSync(dir + 'coelho.png', coelho)

// ---- logo (o k vira o coelho), branco, fundo transparente
const BUNNY = 'M0 5Q0 0 5 0H39Q44 0 44 5L35 135Q35 140 40 140H101Q105 140 105 136V76Q105 71 110 71H134Q139 71 139 76V134Q139 139 134 139H112Q108 139 108 143V171Q108 176 113 176H134Q139 176 139 181V240C139 252 105 260 69.5 260S0 252 0 240ZM41 183H47V196H54V202H41V215H34V202H28V196H41ZM98 183H104V196H111V202H98V215H91V202H85V196H98ZM61 213H78V217H61Z'
const logo = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="112" height="208" viewBox="0 0 140 260"><path fill="#fff" fill-rule="evenodd" d="${BUNNY}"/></svg>`)).png().toBuffer()
writeFileSync(dir + 'logo-coelho.png', logo)

// ---- instagram
const insta = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5.2"/><circle cx="12" cy="12" r="4.1"/><circle cx="17.3" cy="6.7" r="0.6" fill="#fff"/></svg>`)).png().toBuffer()
writeFileSync(dir + 'instagram.png', insta)

// ---- telas do sistema, cortadas em 16:10 e reduzidas
for (const n of ['inicio', 'agenda', 'site']) {
  const jpg = await sharp(telas + n + '.webp').resize({ width: 1040 }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  writeFileSync(dir + `tela-${n}.jpg`, jpg)
}
console.log('ok', { coelho: coelho.length, logo: logo.length, insta: insta.length })

import { CATEGORIES, FONTS, fontHref, isCoverStyleId, isFontId, paletteFor } from '../../src/lib/siteTheme.js'
import { BOOKING_CSS, BOOKING_SCRIPT } from './bookingClient.js'

/** formato devolvido por public.get_public_site(): só o que pode ser exibido ao público */
export interface PublicSite {
  name: string
  slug: string
  settings: {
    tagline?: string
    about?: string
    whatsapp?: string
    instagram?: string
    hours?: string
    accent?: string
    accent_color?: string | null
    logo?: string | null
    cover?: string | null
    address?: string
    online_booking?: boolean
    theme?: string
    palette?: string
    font?: string
    /** estilo da capa sem foto: sobrio, poa, xadrez, editorial ou organico */
    cover_style?: string
    booking_window_days?: number
    show_prices?: boolean
    show_team?: boolean
  }
  services: { id?: string; name: string; category: string; duration: number; price: number | null; photo?: string | null }[]
  /** produtos à venda; photo = id da foto (página pública) ou um endereço já pronto (prévia no app) */
  showcase?: { id?: string; name: string; description: string; price: number | null; photo?: string | null }[]
  plans: { name: string; description: string; includes: string[]; is_new: boolean; price: number | null }[]
  team: { name: string; title: string }[]
  /** só vem preenchido com o agendamento online ligado */
  professionals?: { id: string; name: string }[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Endereço de uma foto, só nos formatos esperados: id (vira /api/photo?id=), endereço https de /api/photo
 * (prévia no app) ou data URL de imagem. Qualquer outra coisa é ignorada.
 */
export function photoSrc(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value) return null
  if (UUID.test(value)) return `/api/photo?id=${value.toLowerCase()}`
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value
  if (/^https:\/\/[a-z0-9.-]+(:\d+)?\/api\/photo\?id=[0-9a-f-]{36}$/i.test(value)) return value
  return null
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
/** tudo que o negócio digita passa por aqui antes de entrar no HTML */
export const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])

export function formatPrice(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n)
}

/** WhatsApp brasileiro -> link wa.me; devolve null se o número não parece válido */
export function whatsappLink(raw: string | undefined, text: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  let number = ''
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) number = digits
  else if (digits.length === 10 || digits.length === 11) number = `55${digits}`
  else return null
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

/** @usuario -> usuario; aceita link do Instagram colado; só letras, números, ponto e sublinhado */
export function instagramHandle(raw: string | undefined): string | null {
  const cleaned = (raw ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(cleaned) ? cleaned : null
}

/** logo e capa vêm do banco como data URL; só entra no HTML se tiver exatamente o formato esperado */
/** logo e capa: data URL antiga ou id de uma foto (servida por /api/photo), com as mesmas travas das outras fotos */
export function safeLogo(raw: string | null | undefined): string | null {
  return photoSrc(raw)
}

const CSS = `
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;padding-bottom:84px}
a{color:inherit}
h1,h2,h3{letter-spacing:-.035em;line-height:1.04;color:var(--ink);margin:0;font-family:var(--display);font-weight:var(--dw);text-transform:var(--du)}
em{font-family:inherit;font-style:normal;color:var(--accent-ink)}
.wrap{max-width:1040px;margin:0 auto;padding:0 10px}
.panel{background:var(--panel);border-radius:28px;margin:10px 0;padding:28px 22px}
@media(min-width:720px){.panel{padding:44px 44px}}
.eyebrow{margin:0 0 14px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}

.top{position:sticky;top:0;z-index:20;padding:10px 0 0}
.top .bar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;padding:8px 10px 8px 20px;border-radius:999px;background:color-mix(in srgb,var(--panel) 92%,transparent);backdrop-filter:blur(14px);box-shadow:0 8px 28px -14px rgba(14,13,13,.35)}
.logo{display:inline-flex;align-items:center;gap:10px;min-width:0;font-weight:600;letter-spacing:-.02em;font-size:18px;color:var(--ink)}
.logo span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.logo img{flex:none;width:38px;height:38px;border-radius:12px;object-fit:cover}
.top nav{display:none;gap:22px;font-size:14px;color:var(--muted)}
@media(min-width:720px){.top nav{display:flex}}
.top nav a{text-decoration:none}.top nav a:hover{color:var(--accent-ink)}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 28px;border-radius:999px;background:var(--accent);color:var(--on);text-decoration:none;font-weight:500;font-size:15px;border:1px solid var(--accent)}
.btn:hover{filter:brightness(1.12)}
.btn--sm{min-height:42px;padding:0 20px;font-size:14px}
.btn--light{background:var(--on);color:var(--accent);border-color:var(--on)}
.btn--ghost{background:transparent;color:inherit;border-color:currentColor}

.hero{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;min-height:min(78vh,620px);padding:28px 22px;background:var(--soft)}
@media(min-width:720px){.hero{padding:48px}}
.hero__img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero--cover:before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(0,0,0,.46) 0%,rgba(0,0,0,.24) 45%,rgba(0,0,0,0) 80%),linear-gradient(180deg,rgba(0,0,0,.14) 0%,rgba(0,0,0,.04) 45%,rgba(0,0,0,.5))}
.hero__in{position:relative;z-index:2;max-width:640px}
.hero h1{font-size:clamp(40px,10vw,84px)}
.hero--cover h1,.hero--cover .hero__lead{color:#fff}
.hero--cover h1 em{color:#fff}
.hero__lead{margin:18px 0 0;max-width:46ch;color:var(--text);font-size:17px}
.hero__cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
.hero--cover .btn--ghost{color:#fff}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
.chip{display:inline-flex;align-items:center;min-height:34px;padding:0 14px;border-radius:999px;background:color-mix(in srgb,var(--panel) 88%,transparent);color:var(--text);font-size:13px;text-decoration:none}
.hero:not(.hero--cover){background:radial-gradient(90% 80% at 88% 8%,color-mix(in srgb,var(--accent) 55%,#fff) 0%,transparent 60%),radial-gradient(70% 70% at 0% 100%,color-mix(in srgb,var(--accent) 70%,#000) 0%,transparent 70%),var(--accent);color:var(--on)}.hero:not(.hero--cover) h1,.hero:not(.hero--cover) h1 em,.hero:not(.hero--cover) .hero__lead{color:var(--on)}.hero:not(.hero--cover) .btn{background:var(--on);color:var(--accent);border-color:var(--on)}.hero:not(.hero--cover) .btn--ghost{background:transparent;color:var(--on);border-color:color-mix(in srgb,var(--on) 60%,transparent)}.hero:not(.hero--cover) .chip{background:color-mix(in srgb,var(--on) 14%,transparent);color:var(--on)}.hero__name{margin:0 0 18px;font-size:13px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;opacity:.85}.hero--cover .hero__name{color:#fff}

.steps{display:grid;gap:12px;margin:0;padding:0;list-style:none;counter-reset:s}
@media(min-width:720px){.steps{grid-template-columns:repeat(3,1fr);gap:16px}}
.steps li{counter-increment:s;display:flex;gap:14px;align-items:flex-start;padding:18px;border-radius:22px;background:var(--soft)}
.steps li:before{content:counter(s);flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--accent);color:var(--on);font-weight:600}
.steps strong{display:block;color:var(--ink);font-weight:500}.steps small{color:var(--muted);font-size:14px}

.about{display:grid;gap:12px}
@media(min-width:720px){.about{grid-template-columns:1fr 2fr;gap:40px}}
.about p{margin:0;font-size:clamp(20px,3vw,28px);line-height:1.35;letter-spacing:-.02em;color:var(--ink)}
.about p.eyebrow{margin:0;font-size:13px;line-height:1.5;letter-spacing:.04em;color:var(--muted)}

.panel>h2{font-size:clamp(30px,6vw,52px);margin-bottom:26px}
.cats{display:grid;gap:12px}
@media(min-width:720px){.cats{grid-template-columns:repeat(2,1fr);gap:16px}}
.cat{padding:22px;border-radius:24px;background:var(--soft)}
.cat h3{font-size:26px;color:var(--accent-ink);margin-bottom:6px}
.cat ul{list-style:none;margin:0;padding:0}
.cat li{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid color-mix(in srgb,var(--ink) 12%,transparent)}
.cat li:last-child{border-bottom:0}
.cat li>span:first-child{flex:1;min-width:0}
.cat small{display:block;color:var(--muted);font-size:13px}
.price{font-weight:600;color:var(--accent-ink);white-space:nowrap}
.go{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--accent);color:var(--on);text-decoration:none;font-size:18px;border:0;cursor:pointer;font-family:inherit}
.go:hover{filter:brightness(1.15)}

.plans{display:grid;gap:14px}
@media(min-width:720px){.plans{grid-template-columns:repeat(2,1fr)}}
.plan{position:relative;display:flex;flex-direction:column;gap:10px;padding:24px;border-radius:24px;background:var(--soft)}
.plan h3{font-size:26px}
.plan .desc{margin:0;color:var(--muted);font-size:15px}
.plan .pp{font-size:36px;letter-spacing:-.04em;color:var(--ink)}.plan .pp small{font-size:14px;color:var(--muted);letter-spacing:0}
.plan ul{list-style:none;margin:4px 0 8px;padding:0;display:grid;gap:6px;font-size:15px}
.plan li:before{content:"";display:inline-block;width:8px;height:8px;margin-right:10px;border-radius:50%;background:var(--accent)}
.plan .btn{margin-top:auto}
.tag{align-self:flex-start;padding:3px 12px;border-radius:999px;background:var(--accent);color:var(--on);font-size:12px;font-weight:600;letter-spacing:.02em}

.team{list-style:none;margin:0;padding:0;display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
.team li{display:flex;align-items:center;gap:14px}
.avatar{display:grid;place-items:center;width:54px;height:54px;border-radius:50%;background:var(--soft);color:var(--accent-ink);font-weight:600;font-size:20px}
.team small{display:block;color:var(--muted);font-size:13px}

.contact{background:var(--accent);color:var(--on)}
.contact h2,.contact h2 em{color:var(--on)}
.contact__grid{display:grid;gap:12px;margin-top:26px}
@media(min-width:720px){.contact__grid{grid-template-columns:repeat(2,1fr)}}
.info{display:flex;flex-direction:column;gap:2px;padding:18px 20px;border-radius:22px;background:color-mix(in srgb,var(--on) 16%,transparent);font-size:15px}
.info small{opacity:.75;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
.info a{color:inherit}
.contact .hero__cta{margin-top:22px}

.thumb{flex:none;width:52px;height:52px;border-radius:14px;object-fit:cover;background:var(--panel)}
.shop{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}
@media(min-width:720px){.shop{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}}
.item{display:flex;flex-direction:column;gap:6px;min-width:0;padding:10px 10px 16px;border-radius:24px;background:var(--soft)}
.item__img{display:block;width:100%;aspect-ratio:1;border-radius:18px;object-fit:cover;background:var(--panel)}
.item__ph{display:grid;place-items:center;width:100%;aspect-ratio:1;border-radius:18px;background:var(--panel);color:var(--accent-ink);font-size:42px;font-family:var(--display)}
.item h3{padding:6px 6px 0;font-size:19px}
.item p{margin:0;padding:0 6px;color:var(--muted);font-size:14px;line-height:1.4}
.item .price{padding:0 6px;font-size:18px}
.item .btn{margin:6px 6px 0;min-height:44px;font-size:14px}
footer{padding:18px 0 28px;text-align:center;color:var(--muted);font-size:13px}
.float{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));z-index:30;transform:translateX(-50%);width:min(420px,calc(100% - 28px));box-shadow:0 14px 34px -10px rgba(0,0,0,.45)}
@media(min-width:720px){.float{width:auto;left:auto;right:24px;transform:none}}
`

/**
 * estilos da capa sem foto (o sóbrio é o degradê padrão). Entram depois do CSS da paleta escura e usam só as variáveis
 * da paleta, então valem para qualquer cor.
 */
const coverStyleCss = (dark: boolean): string => {
  // editorial: superfície escura (a cor do título) com o texto na cor do fundo; na paleta escura, o painel com texto claro
  const surface = dark ? 'var(--panel)' : 'var(--ink)'
  const fg = dark ? 'var(--ink)' : 'var(--bg)'
  const onFg = dark ? 'var(--bg)' : 'var(--ink)'
  const nc = ':not(.hero--cover)'
  /** texto escuro sobre superfície clara */
  const onLight = (c: string, bg: string, extra = '') =>
    `.hero--${c}${nc}{background:${bg};color:var(--ink)}` +
    `.hero--${c}${nc} h1,.hero--${c}${nc} .hero__lead,.hero--${c}${nc} .hero__name{color:var(--ink)}` +
    `.hero--${c}${nc} h1 em{color:var(--accent-ink)}` +
    `.hero--${c}${nc} .btn{background:var(--accent);color:var(--on);border-color:var(--accent)}` +
    `.hero--${c}${nc} .btn--ghost{background:transparent;color:var(--ink);border-color:var(--line)}` +
    `.hero--${c}${nc} .chip{background:var(--soft);color:var(--text)}` +
    extra
  const dots = 'radial-gradient(circle,color-mix(in srgb,var(--accent) 40%,transparent) 2.2px,transparent 2.8px) 0 0/26px 26px'
  const check = 'color-mix(in srgb,var(--accent) 24%,transparent)'
  const gingham = `linear-gradient(90deg,${check} 50%,transparent 50%) 0 0/52px 52px,linear-gradient(${check} 50%,transparent 50%) 0 0/52px 52px,var(--bg)`
  const blobs =
    'radial-gradient(60% 70% at 88% 6%,color-mix(in srgb,var(--accent) 30%,transparent) 0%,transparent 70%),' +
    'radial-gradient(55% 60% at 4% 100%,color-mix(in srgb,var(--accent) 20%,transparent) 0%,transparent 72%),var(--soft)'
  return (
    onLight('poa', `${dots},var(--panel)`) +
    onLight(
      'xadrez',
      gingham,
      `.hero--xadrez{justify-content:center;align-items:center;text-align:center}` +
        `.hero--xadrez .hero__in{width:100%;max-width:560px;padding:30px 24px;border-radius:28px;background:var(--panel);box-shadow:0 18px 40px -22px color-mix(in srgb,var(--ink) 55%,transparent),inset 0 0 0 1px var(--line)}` +
        `.hero--xadrez .hero__cta{justify-content:center}` +
        `.hero--xadrez .hero__lead{margin-inline:auto}`,
    ) +
    onLight('organico', blobs, '.hero--organico{border-radius:56px 56px 140px 56px}') +
    `.hero--editorial${nc}{background:radial-gradient(70% 90% at 100% 0%,color-mix(in srgb,${fg} 18%,transparent) 0%,transparent 60%),${surface};color:${fg}}` +
    `.hero--editorial${nc} h1,.hero--editorial${nc} h1 em,.hero--editorial${nc} .hero__lead,.hero--editorial${nc} .hero__name{color:${fg}}` +
    `.hero--editorial${nc} h1{font-size:clamp(44px,12vw,104px)}` +
    `.hero--editorial${nc} .btn{background:${fg};color:${onFg};border-color:${fg}}` +
    `.hero--editorial${nc} .btn--ghost{background:transparent;color:${fg};border-color:color-mix(in srgb,${fg} 55%,transparent)}` +
    `.hero--editorial${nc} .chip{background:color-mix(in srgb,${fg} 16%,transparent);color:${fg}}`
  )
}

/** paleta escura: o destaque é branco, então capa sem foto e contato continuam escuros em vez de virar blocos brancos */
const DARK_CSS = `
.hero:not(.hero--cover){background:radial-gradient(90% 80% at 88% 8%,#2a2a2a 0%,transparent 60%),var(--panel);color:var(--ink)}
.hero:not(.hero--cover) h1,.hero:not(.hero--cover) h1 em,.hero:not(.hero--cover) .hero__lead{color:var(--ink)}
.hero:not(.hero--cover) .btn{background:var(--accent);color:var(--on);border-color:var(--accent)}
.hero:not(.hero--cover) .btn--ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.hero:not(.hero--cover) .chip{background:var(--soft);color:var(--text)}
.contact{background:var(--soft);color:var(--text)}
.contact h2,.contact h2 em{color:var(--ink)}
.info{background:var(--panel)}
.contact .btn--light{background:var(--accent);color:var(--on);border-color:var(--accent)}
`

/** monta a página pública completa (HTML) do negócio */
export function renderSitePage(site: PublicSite, opts: { canonical: string; captchaSiteKey?: string }): string {
  const s = site.settings ?? {}
  const { p: pal } = paletteFor(s)
  const fontId = isFontId(s.font) ? s.font : 'moderna'
  const font = FONTS[fontId]
  const logo = safeLogo(s.logo)
  const cover = safeLogo(s.cover)
  const coverStyle = !cover && isCoverStyleId(s.cover_style) && s.cover_style !== 'sobrio' ? s.cover_style : null
  const name = site.name
  const showPrices = s.show_prices !== false
  const services = (site.services ?? []).filter((x) => x.name?.trim())
  const plans = (site.plans ?? []).filter((x) => x.name?.trim())
  const team = site.team ?? []

  const ownTagline = (s.tagline ?? '').trim()
  const tagline = ownTagline || 'Seu cuidado começa aqui.'
  const heading = ownTagline || name
  const cut = heading.lastIndexOf(' ')
  const head = cut > 0 ? heading.slice(0, cut) : ''
  const tail = cut > 0 ? heading.slice(cut + 1) : heading
  const about = (s.about ?? '').trim()
  const address = (s.address ?? '').trim()
  const hours = (s.hours ?? '').trim()

  const bookLink = whatsappLink(s.whatsapp, `Olá! Gostaria de agendar um horário no ${name}.`)
  const pros = site.professionals ?? []
  const online = s.online_booking === true && pros.length > 0 && services.some((x) => x.id)
  const insta = instagramHandle(s.instagram)
  const mapLink = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}` : null

  const groups = CATEGORIES.map((category) => ({ category, items: services.filter((x) => x.category === category) })).filter(
    (g) => g.items.length > 0,
  )

  const servicesHtml = groups
    .map((g) => {
      const rows = g.items
        .map((x) => {
          const link = whatsappLink(s.whatsapp, `Olá! Gostaria de agendar "${x.name}" no ${name}.`)
          const go =
            online && x.id
              ? `<button type="button" class="go" data-book="${esc(x.id)}" aria-label="Agendar ${esc(x.name)}">&rarr;</button>`
              : link
                ? `<a class="go" href="${esc(link)}" rel="noopener" aria-label="Agendar ${esc(x.name)} pelo WhatsApp">&rarr;</a>`
                : ''
          const thumb = photoSrc(x.photo)
          return `<li>${thumb ? `<img class="thumb" src="${esc(thumb)}" alt="" width="52" height="52" loading="lazy" decoding="async">` : ''}<span>${esc(x.name)}<small>${esc(x.duration)} min</small></span>${
            showPrices && x.price != null && x.price > 0 ? `<span class="price">${esc(formatPrice(x.price))}</span>` : ''
          }${go}</li>`
        })
        .join('')
      return `<div class="cat"><h3>${esc(g.category)}</h3><ul>${rows}</ul></div>`
    })
    .join('')

  const plansHtml = plans
    .map((p) => {
      const link = whatsappLink(s.whatsapp, `Olá! Tenho interesse no plano "${p.name}" do ${name}.`)
      return `<article class="plan">${p.is_new ? '<span class="tag">Novidade</span>' : ''}<h3>${esc(p.name)}</h3>${
        p.description ? `<p class="desc">${esc(p.description)}</p>` : ''
      }${
        showPrices && p.price != null ? `<p class="pp">${esc(formatPrice(p.price))}<small> /mês</small></p>` : ''
      }${
        p.includes?.length ? `<ul>${p.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''
      }${link ? `<a class="btn" href="${esc(link)}" rel="noopener">Quero este plano</a>` : ''}</article>`
    })
    .join('')

  const showcase = (site.showcase ?? []).filter((x) => x.name?.trim())
  const showcaseHtml = showcase
    .map((x) => {
      const src = photoSrc(x.photo)
      const link = whatsappLink(s.whatsapp, `Olá! Tenho interesse no produto "${x.name}" do ${name}.`)
      return `<article class="item">${
        src ? `<img class="item__img" src="${esc(src)}" alt="${esc(x.name)}" width="400" height="400" loading="lazy" decoding="async">` : `<span class="item__ph" aria-hidden="true">${esc((x.name.trim()[0] ?? '?').toUpperCase())}</span>`
      }<h3>${esc(x.name)}</h3>${x.description ? `<p>${esc(x.description)}</p>` : ''}${
        showPrices && x.price != null && x.price > 0 ? `<span class="price">${esc(formatPrice(x.price))}</span>` : ''
      }${link ? `<a class="btn" href="${esc(link)}" rel="noopener">Quero este</a>` : ''}</article>`
    })
    .join('')

  const teamHtml = team
    .map((m) => `<li><span class="avatar" aria-hidden="true">${esc((m.name || '?').trim()[0]?.toUpperCase() ?? '?')}</span><span>${esc(m.name)}${m.title ? `<small>${esc(m.title)}</small>` : ''}</span></li>`)
    .join('')

  const chips = [hours ? `<span class="chip">${esc(hours)}</span>` : '', address ? `<span class="chip">${esc(address)}</span>` : '']
    .filter(Boolean)
    .join('')

  const description = (about || `${name}: ${tagline}`).slice(0, 160)
  const title = `${name} · ${tagline}`

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name,
    description,
    url: opts.canonical,
    ...(s.whatsapp ? { telephone: s.whatsapp } : {}),
    ...(address ? { address } : {}),
    ...(insta ? { sameAs: [`https://instagram.com/${insta}`] } : {}),
  }).replace(/</g, '\\u003c')

  const bookingData = JSON.stringify({
    slug: site.slug,
    name,
    ts: opts.captchaSiteKey ?? '',
    wa: (bookLink ?? '').match(/wa\.me\/(\d+)/)?.[1] ?? '',
    showPrices,
    windowDays: Math.min(90, Math.max(1, Number(s.booking_window_days) || 30)),
    services: services.filter((x) => x.id).map((x) => ({ id: x.id, name: x.name, category: x.category, duration: x.duration, price: x.price })),
    pros: pros.map((p) => ({ id: p.id, name: p.name })),
  })
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  const bookingWidget = `<dialog id="book" class="sheet" aria-labelledby="book-title"><div class="sheet__head"><h2 id="book-title">Agendar <em>horário</em></h2><button type="button" class="sheet__x" id="book-x" aria-label="Fechar">&times;</button></div><div class="sheet__body" id="book-body"></div><div class="sheet__foot" id="book-foot" hidden></div></dialog><script type="application/json" id="book-data">${bookingData}</script><script>${BOOKING_SCRIPT}</script>`

  const contactCards = [
    s.whatsapp && bookLink ? `<div class="info"><small>WhatsApp</small><a href="${esc(bookLink)}" rel="noopener">${esc(s.whatsapp)}</a></div>` : '',
    insta ? `<div class="info"><small>Instagram</small><a href="https://instagram.com/${esc(insta)}" rel="noopener">@${esc(insta)}</a></div>` : '',
    hours ? `<div class="info"><small>Horário</small><span>${esc(hours)}</span></div>` : '',
    address && mapLink ? `<div class="info"><small>Endereço</small><a href="${esc(mapLink)}" rel="noopener">${esc(address)}</a></div>` : '',
  ]
    .filter(Boolean)
    .join('')

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="${pal.bg}">
<link rel="canonical" href="${esc(opts.canonical)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontHref(fontId)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(opts.canonical)}">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${jsonLd}</script>
<style>:root{--accent:${pal.accent};--accent-ink:${pal.accentInk};--soft:${pal.soft};--on:${pal.on};--bg:${pal.bg};--panel:${pal.panel};--ink:${pal.ink};--text:${pal.text};--muted:${pal.muted};--line:${pal.line};--display:${font.family};--dw:${font.weight};--du:${font.upper ? 'uppercase' : 'none'};color-scheme:${pal.dark ? 'dark' : 'light'}}${CSS}${pal.dark ? DARK_CSS : ''}${coverStyleCss(pal.dark)}${online ? BOOKING_CSS : ''}</style>
</head>
<body>
<header class="top"><div class="wrap"><div class="bar"><span class="logo">${logo ? `<img src="${logo}" alt="">` : ''}<span>${esc(name)}</span></span><nav aria-label="Seções">${
    groups.length ? '<a href="#servicos">Serviços</a>' : ''
  }${plans.length ? '<a href="#planos">Planos</a>' : ''}${showcase.length ? '<a href="#produtos">Produtos</a>' : ''}${team.length ? '<a href="#equipe">Equipe</a>' : ''}${
    contactCards ? '<a href="#contato">Contato</a>' : ''
  }</nav>${
    online
      ? '<button type="button" class="btn btn--sm" data-book="">Agendar</button>'
      : bookLink
        ? `<a class="btn btn--sm" href="${esc(bookLink)}" rel="noopener">Agendar</a>`
        : ''
  }</div></div></header>
<main class="wrap">
<section class="panel hero${cover ? ' hero--cover' : coverStyle ? ` hero--${coverStyle}` : ''}">${cover ? `<img class="hero__img" src="${cover}" alt="">` : ''}<div class="hero__in">${ownTagline ? `<p class="hero__name">${esc(name)}</p>` : ''}<h1>${head ? `${esc(head)} ` : ''}<em>${esc(tail)}</em></h1>${
    about && !cover ? `<p class="hero__lead">${esc(about.slice(0, 140))}</p>` : ''
  }<div class="hero__cta">${
    online
      ? '<button type="button" class="btn" data-book="">Agendar horário</button>'
      : bookLink
        ? `<a class="btn" href="${esc(bookLink)}" rel="noopener">Agendar pelo WhatsApp</a>`
        : ''
  }${
    groups.length ? '<a class="btn btn--ghost" href="#servicos">Ver serviços</a>' : ''
  }</div>${chips ? `<div class="chips">${chips}</div>` : ''}</div></section>${
    bookLink || online
      ? `<section class="panel"><p class="eyebrow">Agendar é simples</p><ol class="steps"><li><span><strong>Escolha o serviço</strong><small>Veja os valores e a duração abaixo.</small></span></li>${
        online
          ? '<li><span><strong>Escolha dia e horário</strong><small>Veja os horários livres na hora.</small></span></li><li><span><strong>Receba a confirmação</strong><small>O salão confirma com você pelo WhatsApp.</small></span></li>'
          : '<li><span><strong>Chame no WhatsApp</strong><small>A mensagem já vai pronta, é só enviar.</small></span></li><li><span><strong>Receba a confirmação</strong><small>Combinamos o melhor dia e horário.</small></span></li>'
      }</ol></section>`
      : ''
  }${
    about ? `<section class="panel about"><p class="eyebrow">Sobre nós</p><p>${esc(about)}</p></section>` : ''
  }${
    groups.length ? `<section id="servicos" class="panel"><h2>Nossos <em>serviços</em></h2><div class="cats">${servicesHtml}</div></section>` : ''
  }${
    showcase.length ? `<section id="produtos" class="panel"><h2>Para levar <em>para casa</em></h2><div class="shop">${showcaseHtml}</div></section>` : ''
  }${
    plans.length ? `<section id="planos" class="panel"><h2>Planos por <em>assinatura</em></h2><div class="plans">${plansHtml}</div></section>` : ''
  }${
    team.length ? `<section id="equipe" class="panel"><h2>Quem cuida de você</h2><ul class="team">${teamHtml}</ul></section>` : ''
  }${
    contactCards || bookLink || online
      ? `<section id="contato" class="panel contact"><h2>Vamos <em>agendar?</em></h2><div class="contact__grid">${contactCards}</div>${
          online || bookLink
            ? `<div class="hero__cta">${online ? '<button type="button" class="btn btn--light" data-book="">Agendar horário</button>' : ''}${
                bookLink ? `<a class="btn ${online ? 'btn--ghost' : 'btn--light'}" href="${esc(bookLink)}" rel="noopener">Chamar no WhatsApp</a>` : ''
              }</div>`
            : ''
        }</section>`
      : ''
  }
</main>
<footer>Página criada com <a href="https://ikizy.com">IKIZY</a></footer>${
    online
      ? '<button type="button" class="btn float" data-book="">Agendar horário</button>'
      : bookLink
        ? `<a class="btn float" href="${esc(bookLink)}" rel="noopener">Agendar pelo WhatsApp</a>`
        : ''
  }${online ? bookingWidget : ''}
</body>
</html>`
}

export function renderNotFound(): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Página não encontrada · IKIZY</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui,sans-serif;color:#242424;background:#f5f5f7;text-align:center;padding:24px}h1{font-weight:400;font-size:32px;margin:0 0 8px}a{color:#bf0c22}</style></head><body><main><h1>Página não encontrada</h1><p>Este endereço não existe ou o site ainda não foi publicado.</p><p><a href="https://ikizy.com">Conheça a IKIZY</a></p></main></body></html>`
}

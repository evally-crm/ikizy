import { CATEGORIES, resolveAccent } from '../../src/lib/siteTheme.js'

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
    show_prices?: boolean
    show_team?: boolean
  }
  services: { name: string; category: string; duration: number; price: number | null }[]
  plans: { name: string; description: string; includes: string[]; is_new: boolean; price: number | null }[]
  team: { name: string; title: string }[]
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

/** logo vem do banco como data URL; só entra no HTML se tiver exatamente o formato esperado */
export function safeLogo(raw: string | null | undefined): string | null {
  return typeof raw === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw) ? raw : null
}

const CSS = `
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:#fff;color:#242424;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:880px;margin:0 auto;padding:0 20px}
.top{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.94);border-bottom:1px solid #eee}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;height:60px}
.logo{display:inline-flex;align-items:center;gap:10px;font-weight:600;letter-spacing:-.02em;font-size:18px;color:#0e0d0d}
.logo img{width:36px;height:36px;border-radius:10px;object-fit:cover}
.top nav{display:flex;gap:18px;font-size:14px;color:#6b6668}
.top nav a{text-decoration:none}
.top nav a:hover{color:var(--accent)}
h1,h2,h3{font-weight:400;letter-spacing:-.03em;line-height:1.1;color:#0e0d0d;margin:0}
em{font-family:Georgia,"Times New Roman",serif;font-style:italic;color:var(--accent)}
.hero{padding:56px 20px 40px}
.hero h1{font-size:clamp(36px,8vw,64px);max-width:14ch}
.hero p{max-width:52ch;margin:18px 0 0;color:#6b6668;font-size:17px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 26px;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none;font-weight:500;font-size:15px}
.btn:hover{filter:brightness(1.1)}
.btn--ghost{background:transparent;color:var(--accent);border:1px solid var(--accent)}
.hero .btn{margin-top:26px}
section.block{padding:36px 20px}
section.block>h2{font-size:clamp(26px,5vw,38px);margin-bottom:20px}
.group{margin-bottom:22px}
.group h3{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:22px;color:var(--accent);margin-bottom:6px}
.group ul{list-style:none;margin:0;padding:0;background:var(--soft);border-radius:20px;padding:6px 20px}
.group li{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid rgba(0,0,0,.07)}
.group li:last-child{border-bottom:0}
.group small{display:block;color:#6b6668;font-size:13px}
.price{font-weight:600;color:var(--accent);white-space:nowrap}
.plans{display:grid;gap:14px}
@media(min-width:720px){.plans{grid-template-columns:repeat(2,1fr)}}
.plan{position:relative;display:flex;flex-direction:column;gap:10px;padding:24px;border-radius:24px;background:var(--soft)}
.plan h3{font-size:24px}
.plan .desc{margin:0;color:#6b6668;font-size:15px}
.plan .pp{font-size:34px;letter-spacing:-.04em;color:#0e0d0d}.plan .pp small{font-size:14px;color:#6b6668;letter-spacing:0}
.plan ul{list-style:none;margin:4px 0 8px;padding:0;display:grid;gap:6px;font-size:15px}
.plan li:before{content:"";display:inline-block;width:8px;height:8px;margin-right:10px;border-radius:50%;background:var(--accent)}
.plan .btn{margin-top:auto}
.tag{align-self:flex-start;padding:3px 12px;border-radius:999px;background:var(--accent);color:#fff;font-size:12px;font-weight:600;letter-spacing:.02em}
.team{list-style:none;margin:0;padding:0;display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.team li{display:flex;align-items:center;gap:12px}
.avatar{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:var(--soft);color:var(--accent);font-weight:600}
.team small{display:block;color:#6b6668;font-size:13px}
footer{margin-top:24px;padding:32px 20px 40px;background:#0e0d0d;color:rgba(255,255,255,.75);font-size:15px}
footer .wrap{display:grid;gap:6px}
footer a{color:#fff}
footer small{margin-top:14px;color:rgba(255,255,255,.5)}
`

/** monta a página pública completa (HTML) do negócio */
export function renderSitePage(site: PublicSite, opts: { canonical: string }): string {
  const s = site.settings ?? {}
  const accent = resolveAccent(s.accent, s.accent_color)
  const logo = safeLogo(s.logo)
  const name = site.name
  const showPrices = s.show_prices !== false
  const services = (site.services ?? []).filter((x) => x.name?.trim())
  const plans = (site.plans ?? []).filter((x) => x.name?.trim())
  const team = site.team ?? []

  const tagline = (s.tagline ?? '').trim() || 'Seu cuidado começa aqui.'
  const cut = tagline.lastIndexOf(' ')
  const head = cut > 0 ? tagline.slice(0, cut) : ''
  const tail = cut > 0 ? tagline.slice(cut + 1) : tagline
  const about = (s.about ?? '').trim()

  const bookLink = whatsappLink(s.whatsapp, `Olá! Gostaria de agendar um horário no ${name}.`)
  const insta = instagramHandle(s.instagram)

  const groups = CATEGORIES.map((category) => ({ category, items: services.filter((x) => x.category === category) })).filter(
    (g) => g.items.length > 0,
  )

  const servicesHtml = groups
    .map(
      (g) => `<div class="group"><h3>${esc(g.category)}</h3><ul>${g.items
        .map(
          (x) =>
            `<li><span>${esc(x.name)}<small>${esc(x.duration)} min</small></span>${
              showPrices && x.price != null ? `<span class="price">${esc(formatPrice(x.price))}</span>` : ''
            }</li>`,
        )
        .join('')}</ul></div>`,
    )
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

  const teamHtml = team
    .map((m) => `<li><span class="avatar" aria-hidden="true">${esc((m.name || '?').trim()[0]?.toUpperCase() ?? '?')}</span><span>${esc(m.name)}${m.title ? `<small>${esc(m.title)}</small>` : ''}</span></li>`)
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
    ...(insta ? { sameAs: [`https://instagram.com/${insta}`] } : {}),
  }).replace(/</g, '\\u003c')

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="${accent.color}">
<link rel="canonical" href="${esc(opts.canonical)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(opts.canonical)}">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${jsonLd}</script>
<style>:root{--accent:${accent.color};--soft:${accent.soft}}${CSS}</style>
</head>
<body>
<header class="top"><div class="wrap"><span class="logo">${logo ? `<img src="${logo}" alt="">` : ''}${esc(name)}</span><nav aria-label="Seções">${
    groups.length ? '<a href="#servicos">Serviços</a>' : ''
  }${plans.length ? '<a href="#planos">Planos</a>' : ''}${team.length ? '<a href="#equipe">Equipe</a>' : ''}</nav></div></header>
<main>
<section class="hero wrap"><h1>${head ? `${esc(head)} ` : ''}<em>${esc(tail)}</em></h1>${about ? `<p>${esc(about)}</p>` : ''}${
    bookLink ? `<a class="btn" href="${esc(bookLink)}" rel="noopener">Agendar pelo WhatsApp</a>` : ''
  }</section>${
    groups.length ? `<section id="servicos" class="block wrap"><h2>Nossos serviços</h2>${servicesHtml}</section>` : ''
  }${
    plans.length ? `<section id="planos" class="block wrap"><h2>Planos por <em>assinatura</em></h2><div class="plans">${plansHtml}</div></section>` : ''
  }${
    team.length ? `<section id="equipe" class="block wrap"><h2>Quem cuida de você</h2><ul class="team">${teamHtml}</ul></section>` : ''
  }
</main>
<footer><div class="wrap">${s.hours ? `<span>${esc(s.hours)}</span>` : ''}${
    s.whatsapp && bookLink ? `<span>WhatsApp: <a href="${esc(bookLink)}" rel="noopener">${esc(s.whatsapp)}</a></span>` : ''
  }${insta ? `<span>Instagram: <a href="https://instagram.com/${esc(insta)}" rel="noopener">@${esc(insta)}</a></span>` : ''}<small>Página criada com <a href="https://ikizy.com">IKIZY</a></small></div></footer>
</body>
</html>`
}

export function renderNotFound(): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Página não encontrada · IKIZY</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui,sans-serif;color:#242424;background:#f5f5f7;text-align:center;padding:24px}h1{font-weight:400;font-size:32px;margin:0 0 8px}a{color:#bf0c22}</style></head><body><main><h1>Página não encontrada</h1><p>Este endereço não existe ou o site ainda não foi publicado.</p><p><a href="https://ikizy.com">Conheça a IKIZY</a></p></main></body></html>`
}

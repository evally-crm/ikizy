import { CATEGORIES, FONTS, coverPattern, fontHref, isCoverStyleId, isFontId, paletteFor } from '../../src/lib/siteTheme.js'
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


.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 28px;border-radius:999px;background:var(--accent);color:var(--on);text-decoration:none;font-weight:500;font-size:15px;border:1px solid var(--accent)}
.btn:hover{filter:brightness(1.12)}
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

.bio{padding:10px 10px 26px}
.bio>.hero{min-height:200px;padding:0;border-radius:28px}
.bio>.hero--cover:before{display:none}
@media(min-width:720px){.bio{padding:10px 10px 40px}.bio>.hero{min-height:260px}}
.card{position:relative;z-index:3;margin:-70px max(10px,calc((100% - 560px)/2)) 0;padding:0 20px 20px;border-radius:28px;background:var(--panel)}
.card__head{display:flex;align-items:flex-start;gap:14px}
/* com foto de perfil: a capa fica atrás do cartão inteiro e aparece em volta dele (em cima, dos lados e embaixo) */
.bio:not(.bio--split){display:grid;grid-template-columns:minmax(0,1fr)}
.bio:not(.bio--split)>.hero{grid-area:1/1;min-height:0}
.bio:not(.bio--split)>.tiles{width:100%}
.bio:not(.bio--split)>.card{grid-area:1/1;align-self:end;width:calc(100% - 24px);max-width:560px;margin:118px auto 12px;border-radius:24px}
/* computador: capa de um lado e o cartão do outro, lado a lado; a foto entra no cartão */
@media(min-width:720px){.bio:not(.bio--split){grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.bio:not(.bio--split)>.hero{grid-area:1/1;min-height:460px}.bio:not(.bio--split)>.card{grid-area:1/2;align-self:stretch;display:flex;flex-direction:column;justify-content:center;width:auto;max-width:none;margin:0;padding:36px 40px;border-radius:28px;background:var(--soft)}.bio:not(.bio--split) .card__head{align-items:center}.bio:not(.bio--split) .card__avatar{margin-top:0;border-color:var(--panel)}.bio:not(.bio--split) .card__id{padding-top:0}.bio:not(.bio--split)>.tiles{grid-column:1/-1;max-width:none;margin-top:0}}
.card__avatar{flex:none;display:grid;place-items:center;width:104px;height:104px;margin-top:-52px;border-radius:50%;border:5px solid var(--panel);background:var(--accent);color:var(--on);font-family:var(--display);font-size:34px;overflow:hidden}
.card__avatar img{width:100%;height:100%;object-fit:cover}
.card__id{flex:1;min-width:0;padding-top:10px}
.bio--split .card{margin:0;padding:22px 12px 4px}
.bio--split>.hero--cover{min-height:min(118vw,480px)}
.bio--split .card h1{font-size:clamp(34px,9.5vw,56px);line-height:1.02;letter-spacing:-.035em}
@media(min-width:720px){.bio--split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:stretch}.bio--split>.hero,.bio--split>.hero--cover{min-height:500px}.bio--split .card{display:flex;flex-direction:column;justify-content:center;padding:36px 40px;border-radius:28px;background:var(--soft)}.bio--split .tiles{grid-column:1/-1;max-width:none;width:100%;margin-top:0}}
.card h1{font-size:clamp(34px,9.6vw,48px);line-height:1;letter-spacing:-.025em;overflow-wrap:anywhere}.card h1.is-long{font-size:clamp(24px,6.6vw,36px);line-height:1.05}
.card__tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.pill{padding:3px 11px;border-radius:999px;background:color-mix(in srgb,var(--accent) 14%,var(--panel));color:var(--accent-ink);font-size:12px;font-weight:500;white-space:nowrap}
.pill:nth-child(even){background:color-mix(in srgb,var(--ink) 7%,var(--panel));color:var(--text)}
.card__text{margin:16px 0 0;color:var(--muted);font-size:15px;line-height:1.5}
.card__place{display:flex;align-items:center;gap:6px;margin-top:10px;color:var(--muted);font-size:13px;text-decoration:none}
.card__place svg{flex:none;width:16px;height:16px;color:var(--accent-ink)}
.card__place span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card__place:hover span{text-decoration:underline}
.card__actions{display:flex;gap:8px;margin-top:18px}
.card__cta{flex:1;min-width:0;min-height:56px;padding:0 16px;background:var(--ink);color:var(--panel);border-color:var(--ink);font-size:16px;cursor:pointer;font-family:inherit}
.card__cta svg{flex:none;width:20px;height:20px}
.round{flex:none;display:grid;place-items:center;width:52px;height:56px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--ink)}
@media(min-width:380px){.round{width:56px}}
.round svg{width:22px;height:22px}
.round:hover{background:var(--soft)}
.tiles{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:10px;max-width:560px;margin:20px auto 0;padding:0 4px}
.tile{display:flex;flex-direction:column;align-items:center;gap:9px;padding:16px 4px 13px;border-radius:22px;background:var(--soft);color:var(--ink);text-decoration:none;font-size:13px;font-weight:500;text-align:center}
.tile svg{width:26px;height:26px;color:var(--accent-ink)}
.tile:hover{background:color-mix(in srgb,var(--accent) 12%,var(--soft))}

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
.float{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));z-index:30;transform:translateX(-50%);width:min(420px,calc(100% - 28px))}
@media(min-width:720px){.float{width:auto;left:auto;right:24px;transform:none}}
.float{transition:opacity .2s,visibility .2s}.float.is-off{opacity:0;visibility:hidden}
`

/**
 * ícones do topo: os mesmos do app (Lucide, licença ISC), desenhados em traço na cor do texto.
 * Na fonte forte o traço fica mais grosso, acompanhando os títulos pesados.
 */
const ICON_PATHS = {
  servicos: '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>',
  planos: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
  produtos: '<path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/>',
  equipe: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  whatsapp: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>',
  mapa: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  agenda: '<path d="M16 18h6"/><path d="M16 2v3"/><path d="M19 15v6"/><path d="M21 11.5V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h8.3"/><path d="M3 9h18"/><path d="M8 2v3"/>',
  instagram: '<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/>',
} as const
type IconName = keyof typeof ICON_PATHS
const iconSet = (bold: boolean) =>
  Object.fromEntries(
    Object.entries(ICON_PATHS).map(([k, d]) => [
      k,
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${bold ? 2.6 : 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`,
    ]),
  ) as Record<IconName, string>

/** capa sem foto e sem estilo (sóbrio) nas paletas claras: manchas desfocadas em tons da cor do negócio, atrás do cartão */
const SOFT_HERO_CSS = `
.bio>.hero[class="hero"]{background:radial-gradient(45% 75% at 18% 35%,color-mix(in srgb,var(--accent) 55%,transparent) 0%,transparent 70%),radial-gradient(40% 70% at 62% 10%,color-mix(in srgb,var(--accent) 35%,#fff) 0%,transparent 72%),radial-gradient(45% 80% at 92% 55%,color-mix(in srgb,var(--accent) 70%,#fff) 0%,transparent 70%),color-mix(in srgb,var(--accent) 22%,var(--soft))}
`

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
  const ICONS = iconSet(fontId === 'forte')
  const logo = safeLogo(s.logo)
  const cover = safeLogo(s.cover)
  const coverStyle = !cover && isCoverStyleId(s.cover_style) && s.cover_style !== 'sobrio' ? s.cover_style : null
  // textura da capa desenhada nas cores da paleta (só a escolhida entra na página)
  const coverBg = coverStyle ? coverPattern(coverStyle, pal) : null
  const name = site.name
  const showPrices = s.show_prices !== false
  const services = (site.services ?? []).filter((x) => x.name?.trim())
  const plans = (site.plans ?? []).filter((x) => x.name?.trim())
  const team = site.team ?? []

  const ownTagline = (s.tagline ?? '').trim()
  const tagline = ownTagline || 'Seu cuidado começa aqui.'
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

  // topo em perfil. Com logo: cartão sobre a capa, logo redonda na borda. Sem logo: a capa de um lado e os dados do outro
  // (no celular, a capa em cima). Nos dois: nome com etiquetas, frase, endereço e botões
  const pills = [...groups.slice(0, 2).map((g) => g.category), hours].filter(Boolean)
  const cardText = ownTagline || about.slice(0, 140)
  const tiles = [
    groups.length ? ['#servicos', ICONS.servicos, 'Serviços'] : null,
    plans.length ? ['#planos', ICONS.planos, 'Planos'] : null,
    showcase.length ? ['#produtos', ICONS.produtos, 'Produtos'] : null,
    team.length ? ['#equipe', ICONS.equipe, 'Equipe'] : null,
  ].filter((t): t is string[] => t !== null)
  const tilesHtml = tiles.length
    ? `<nav class="tiles" style="--n:${tiles.length}" aria-label="Seções">${tiles.map(([href, icon, label]) => `<a class="tile" href="${href}">${icon}${esc(label)}</a>`).join('')}</nav>`
    : ''
  const talkLink = whatsappLink(s.whatsapp, `Olá! Vim pelo site do ${name}.`)
  const round = (href: string, icon: string, label: string) => `<a class="round" href="${esc(href)}" rel="noopener" aria-label="${esc(label)}">${icon}</a>`
  const rounds = [
    talkLink ? round(talkLink, ICONS.whatsapp, 'Falar no WhatsApp') : '',
    insta ? round(`https://instagram.com/${insta}`, ICONS.instagram, `Instagram @${insta}`) : '',
  ]
    .filter(Boolean)
    .join('')
  // endereço numa linha discreta que abre o mapa (dois botões redondos, como no modelo, deixam o "Agendar" largo)
  const placeHtml = address && mapLink ? `<a class="card__place" href="${esc(mapLink)}" rel="noopener">${ICONS.mapa}<span>${esc(address)}</span></a>` : ''
  const cta = online
    ? `<button type="button" class="btn card__cta" data-book="">${ICONS.agenda}Agendar</button>`
    : bookLink
      ? `<a class="btn card__cta" href="${esc(bookLink)}" rel="noopener">${ICONS.agenda}Agendar</a>`
      : ''

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
<style>:root{--accent:${pal.accent};--accent-ink:${pal.accentInk};--soft:${pal.soft};--on:${pal.on};--bg:${pal.bg};--panel:${pal.panel};--ink:${pal.ink};--text:${pal.text};--muted:${pal.muted};--line:${pal.line};--display:${font.family};--dw:${font.weight};--du:${font.upper ? 'uppercase' : 'none'};color-scheme:${pal.dark ? 'dark' : 'light'}}${CSS}${pal.dark ? DARK_CSS : SOFT_HERO_CSS}${coverBg ? `.bio>.hero--${coverStyle}{background:${coverBg}}` : ''}${online ? BOOKING_CSS : ''}</style>
</head>
<body>
<main class="wrap">
<section class="panel bio${logo ? '' : ' bio--split'}"><div class="hero${cover ? ' hero--cover' : coverStyle ? ` hero--${coverStyle}` : ''}">${cover ? `<img class="hero__img" src="${esc(cover)}" alt="">` : ''}</div><div class="card"><div class="card__head">${
    logo ? `<span class="card__avatar"><img src="${logo}" alt=""></span>` : ''
  }<div class="card__id"><h1${name.length > 14 ? ' class="is-long"' : ''}>${esc(name)}</h1></div></div>${
    pills.length ? `<div class="card__tags">${pills.map((p) => `<span class="pill">${esc(p)}</span>`).join('')}</div>` : ''
  }${cardText ? `<p class="card__text">${esc(cardText)}</p>` : ''}${placeHtml}${
    cta || rounds ? `<div class="card__actions">${cta}${rounds}</div>` : ''
  }</div>${tilesHtml}</section>${
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
      ? '<button type="button" class="btn float is-off" data-book="">Agendar horário</button>'
      : bookLink
        ? `<a class="btn float is-off" href="${esc(bookLink)}" rel="noopener">Agendar pelo WhatsApp</a>`
        : ''
  }${online ? bookingWidget : ''}${
    online || bookLink
      ? // o botão flutuante começa escondido e só aparece quando o "Agendar" do topo sai da tela; sem o observador ele fica sempre visível
        `<script>(function(){var c=document.querySelector('.card__cta'),f=document.querySelector('.float');if(!f)return;if(!c||!('IntersectionObserver' in window)){f.classList.remove('is-off');return}new IntersectionObserver(function(e){f.classList.toggle('is-off',e[0].isIntersecting)}).observe(c)})()</script>`
      : ''
  }
</body>
</html>`
}

export function renderNotFound(): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Página não encontrada · IKIZY</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui,sans-serif;color:#242424;background:#f5f5f7;text-align:center;padding:24px}h1{font-weight:400;font-size:32px;margin:0 0 8px}a{color:#63001f}</style></head><body><main><h1>Página não encontrada</h1><p>Este endereço não existe ou o site ainda não foi publicado.</p><p><a href="https://ikizy.com">Conheça a IKIZY</a></p></main></body></html>`
}

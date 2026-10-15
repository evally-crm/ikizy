import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { esc, formatPrice, instagramHandle, renderNotFound, renderSitePage, whatsappLink, type PublicSite } from './siteHtml.js'

const base = (over: Partial<PublicSite> = {}, settings: PublicSite['settings'] = {}): PublicSite => ({
  name: 'Studio Maria Beauty',
  slug: 'studio-maria-beauty',
  settings: {
    tagline: 'Cuidado de verdade, do esmalte ao olhar',
    about: 'Um espaço pequeno e acolhedor.',
    whatsapp: '(11) 98765-0000',
    instagram: '@studiomariabeauty',
    hours: 'Seg a Sáb · 09h às 19h',
    accent: 'rubi',
    show_prices: true,
    show_team: true,
    ...settings,
  },
  services: [
    { name: 'Alongamento em gel', category: 'Unhas', duration: 120, price: 220 },
    { name: 'Fio a fio', category: 'Cílios', duration: 120, price: 260.5 },
  ],
  plans: [
    {
      name: 'Alongamento por assinatura',
      description: 'Manutenção todo mês',
      includes: ['2 manutenções por mês', 'Prioridade na agenda'],
      is_new: true,
      price: 299.9,
    },
  ],
  team: [{ name: 'Maria', title: 'Nail designer' }],
  ...over,
})

const page = (site: PublicSite) => renderSitePage(site, { canonical: 'https://app.ikizy.com/s/studio-maria-beauty' })

describe('esc', () => {
  it('neutraliza HTML e aspas', () => {
    assert.equal(esc(`<script>alert("x")</script> & 'a'`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;a&#39;')
    assert.equal(esc(null), '')
  })
})

describe('whatsappLink / instagramHandle / formatPrice', () => {
  it('normaliza telefones brasileiros', () => {
    assert.equal(whatsappLink('(11) 98765-0000', 'oi'), 'https://wa.me/5511987650000?text=oi')
    assert.equal(whatsappLink('+55 11 98765-0000', 'oi'), 'https://wa.me/5511987650000?text=oi')
    assert.equal(whatsappLink('11 3333-4444', 'oi'), 'https://wa.me/551133334444?text=oi')
    assert.equal(whatsappLink('123', 'oi'), null)
    assert.equal(whatsappLink(undefined, 'oi'), null)
  })
  it('codifica o texto da mensagem', () => {
    assert.match(whatsappLink('11987650000', 'Olá! Plano "X" & Y') ?? '', /text=Ol%C3%A1!%20Plano%20%22X%22%20%26%20Y$/)
  })
  it('aceita @usuario e link; recusa lixo e tentativa de injeção', () => {
    assert.equal(instagramHandle('@studio.maria'), 'studio.maria')
    assert.equal(instagramHandle('https://www.instagram.com/studio_maria/?hl=pt'), 'studio_maria')
    assert.equal(instagramHandle('"><script>'), null)
    assert.equal(instagramHandle(''), null)
  })
  it('preço sem centavos quando inteiro', () => {
    assert.match(formatPrice(220), /^R\$\s220$/)
    assert.match(formatPrice(299.9), /^R\$\s299,90$/)
  })
})

describe('renderSitePage', () => {
  it('traz nome, destaque em itálico, serviços, plano com etiqueta Novidade e equipe', () => {
    const html = page(base())
    assert.match(html, /<title>Studio Maria Beauty · Cuidado de verdade, do esmalte ao olhar<\/title>/)
    assert.match(html, /<h1>Cuidado de verdade, do esmalte ao <em>olhar<\/em><\/h1>/)
    assert.match(html, /Alongamento em gel/)
    assert.match(html, /<span class="tag">Novidade<\/span>/)
    assert.match(html, /Alongamento por assinatura/)
    assert.match(html, /2 manutenções por mês/)
    assert.match(html, /R\$\s299,90/)
    assert.match(html, /R\$\s260,50/)
    assert.match(html, /Quem cuida de você/)
    assert.match(html, /rel="canonical" href="https:\/\/app\.ikizy\.com\/s\/studio-maria-beauty"/)
  })

  it('plano sem Novidade não mostra a etiqueta', () => {
    const site = base()
    site.plans[0].is_new = false
    assert.doesNotMatch(page(site), /class="tag"/)
  })

  it('"Quero este plano" e "Agendar" abrem o WhatsApp com mensagem pronta', () => {
    const html = page(base())
    assert.match(html, /href="https:\/\/wa\.me\/5511987650000\?text=Ol%C3%A1!%20Tenho%20interesse%20no%20plano%20%22Alongamento%20por%20assinatura%22/)
    assert.match(html, /Agendar pelo WhatsApp/)
    assert.match(html, /Quero este plano/)
  })

  it('sem mostrar preços, nenhum valor aparece (serviços e planos)', () => {
    const site = base({}, { show_prices: false })
    site.services = site.services.map((s) => ({ ...s, price: null }))
    site.plans = site.plans.map((p) => ({ ...p, price: null }))
    const html = page(site)
    assert.doesNotMatch(html, /R\$/)
    assert.match(html, /Alongamento por assinatura/)
  })

  it('sem equipe, sem plano e sem WhatsApp: seções e botões somem', () => {
    const html = page(base({ team: [], plans: [] }, { whatsapp: '' }))
    assert.doesNotMatch(html, /id="equipe"/)
    assert.doesNotMatch(html, /id="planos"/)
    assert.doesNotMatch(html, /wa\.me/)
  })

  it('texto digitado pelo negócio nunca vira HTML (XSS)', () => {
    const evil = '<img src=x onerror=alert(1)>'
    const site = base(
      { name: evil, plans: [{ name: evil, description: evil, includes: [evil], is_new: true, price: 1 }], team: [{ name: evil, title: evil }] },
      { tagline: `${evil} ${evil}`, about: evil, hours: evil, instagram: evil },
    )
    site.services = [{ name: evil, category: 'Unhas', duration: 10, price: 1 }]
    const html = page(site)
    assert.doesNotMatch(html, /<img/)
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  })

  it('JSON-LD não deixa fechar o script', () => {
    const html = page(base({ name: '</script><b>x' }))
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? ''
    assert.doesNotMatch(ld, /<\/script/i)
    assert.doesNotThrow(() => JSON.parse(ld))
  })

  it('cor antiga ou desconhecida cai no vermelho', () => {
    assert.match(page(base({}, { accent: 'neon' })), /--accent:#930500/)
    assert.match(page(base({}, { accent: 'rubi' })), /--accent:#930500/)
  })

  it('paleta escolhida define as cores da página; sem paleta, vale a cor antiga', () => {
    assert.match(page(base({}, { palette: 'verde-musgo' })), /--accent:#265514/)
    assert.match(page(base({}, { palette: 'azul', accent: 'rubi' })), /--accent:#0259ba/)
    assert.match(page(base({}, { palette: 'verde-musgo' })), /--bg:#f2f5f1/)
    assert.match(page(base({}, { palette: 'neon' })), /--accent:#930500/)
    // paleta antiga salva no banco vira a atual mais próxima
    assert.match(page(base({}, { palette: 'creme-pinho' })), /--accent:#265514/)
  })

  it('logo só entra se for data URL de imagem válida', () => {
    const ok = 'data:image/webp;base64,AAAA'
    assert.match(page(base({}, { logo: ok })), /<img src="data:image\/webp;base64,AAAA"/)
    assert.doesNotMatch(page(base({}, { logo: 'javascript:alert(1)' })), /<img/)
    assert.doesNotMatch(page(base({}, { logo: 'data:image/svg+xml;base64,AAAA' })), /<img/)
    assert.doesNotMatch(page(base({}, { logo: 'data:image/png;base64,AA"onerror="x' })), /<img/)
  })

  it('cada serviço tem botão de agendar com o nome do serviço na mensagem', () => {
    const html = page(base())
    assert.match(html, /href="https:\/\/wa\.me\/5511987650000\?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20%22Alongamento%20em%20gel%22/)
  })

  it('endereço vira link para o mapa e capa só entra se for imagem válida', () => {
    const html = page(base({}, { address: 'Rua das Flores, 100 - Centro', cover: 'data:image/jpeg;base64,BBBB' }))
    assert.match(html, /google\.com\/maps\/search\/\?api=1&amp;query=/)
    assert.match(html, /Rua das Flores, 100 - Centro/)
    assert.match(html, /class="hero__img" src="data:image\/jpeg;base64,BBBB"/)
    assert.doesNotMatch(page(base({}, { cover: 'http://evil.example/x.png' })), /<img class="hero__img"/)
  })

  const SVC = '11111111-1111-4111-8111-111111111111'
  const PRO = '22222222-2222-4222-8222-222222222222'
  const online = (settings: PublicSite['settings'] = {}) => {
    const site = base({ professionals: [{ id: PRO, name: 'Ana' }] }, { online_booking: true, booking_window_days: 21, ...settings })
    site.services[0].id = SVC
    return site
  }

  it('agendamento online ligado: botão abre a janela, serviço tem botão próprio e há dados para o script', () => {
    const html = page(online())
    assert.match(html, /<dialog id="book"/)
    assert.match(html, /data-book=""[^>]*>Agendar horário</)
    assert.match(html, new RegExp(`data-book="${SVC}"`))
    const data = JSON.parse(html.match(/<script type="application\/json" id="book-data">([\s\S]*?)<\/script>/)?.[1] ?? 'null')
    assert.equal(data.slug, 'studio-maria-beauty')
    assert.equal(data.windowDays, 21)
    assert.equal(data.wa, '5511987650000')
    assert.deepEqual(data.pros, [{ id: PRO, name: 'Ana' }])
    assert.equal(data.services.length, 1)
  })

  it('agendamento online desligado, ou sem profissionais: nada da janela aparece', () => {
    assert.doesNotMatch(page(base()), /<dialog|id="book-data"|data-book/)
    assert.doesNotMatch(page(online({ online_booking: false })), /<dialog|data-book/)
    const noPros = online()
    noPros.professionals = []
    assert.doesNotMatch(page(noPros), /<dialog|data-book/)
  })

  it('nomes digitados nunca fecham o script de dados nem viram HTML', () => {
    const evil = '</script><img src=x onerror=alert(1)>'
    const site = online()
    site.professionals = [{ id: PRO, name: evil }]
    site.services[0].name = evil
    const html = page(site)
    const data = html.match(/<script type="application\/json" id="book-data">([\s\S]*?)<\/script>/)?.[1] ?? ''
    assert.doesNotMatch(data, /<\/script/i)
    assert.equal(JSON.parse(data).pros[0].name, evil)
    assert.doesNotMatch(html, /<img src=x/)
  })

  it('paleta e fonte forte entram como variáveis da página', () => {
    const html = page(base({}, { palette: 'preto', font: 'forte' }))
    assert.match(html, /--bg:#f2f2f2/)
    assert.match(html, /--accent:#000000/)
    assert.match(html, /--du:uppercase/)
    assert.match(html, /--dw:800/)
    assert.match(html, /--display:Raleway,/)
    assert.match(html, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Raleway:wght@800&display=swap">/)
    assert.doesNotMatch(html, /family=Manrope|family=Forum/)
    assert.match(html, /<meta name="theme-color" content="#f2f2f2">/)
  })

  it('rosa bebê: botão na cor exata com texto escuro; itálicos e preços num tom mais fechado', () => {
    const html = page(base({}, { palette: 'rosa-bebe' }))
    assert.match(html, /--accent:#dd88c1;--accent-ink:#8d577c;/)
    assert.match(html, /--on:#4d3044/)
    assert.match(html, /\.price\{font-weight:600;color:var\(--accent-ink\)/)
  })

  it('paleta e fonte desconhecidas voltam ao vermelho e à fonte moderna', () => {
    const html = page(base({}, { palette: 'neon', accent: 'x', font: 'comic' }))
    assert.match(html, /--bg:#f9f0f0/)
    assert.match(html, /color-scheme:light/)
    assert.match(html, /--du:none/)
  })

  const PHOTO = '351b4862-88ae-4ba3-9daa-8e39ef498b04'

  it('vitrine: produtos com foto, preço e botão do WhatsApp; link no menu', () => {
    const site = base()
    site.showcase = [
      { name: 'Óleo de cutícula', description: 'Hidrata e protege', price: 35.5, photo: PHOTO },
      { name: 'Lixa', description: '', price: 8, photo: null },
    ]
    const html = page(site)
    assert.match(html, /id="produtos"/)
    assert.match(html, /<a href="#produtos">Produtos<\/a>/)
    assert.match(html, new RegExp(`<img class="item__img" src="/api/photo\\?id=${PHOTO}" alt="Óleo de cutícula"`))
    assert.match(html, /R\$\s35,50/)
    assert.match(html, /Tenho%20interesse%20no%20produto%20%22%C3%93leo%20de%20cut%C3%ADcula%22/)
    assert.match(html, /class="item__ph"[^>]*>L</)
  })

  it('sem produtos, a seção e o link somem; sem mostrar preços, o valor some', () => {
    assert.doesNotMatch(page(base()), /id="produtos"|href="#produtos"/)
    const site = base({}, { show_prices: false })
    site.showcase = [{ name: 'Óleo', description: '', price: null, photo: null }]
    assert.doesNotMatch(page(site), /R\$/)
  })

  it('foto de serviço aparece como miniatura; fotos só em formatos seguros', () => {
    const site = base()
    site.services[0].photo = PHOTO
    assert.match(page(site), new RegExp(`<img class="thumb" src="/api/photo\\?id=${PHOTO}"`))
    for (const bad of ['javascript:alert(1)', 'http://evil.example/a.png', 'data:image/svg+xml;base64,AAAA', 'https://evil.example/x.png', '"><script>']) {
      site.services[0].photo = bad
      assert.doesNotMatch(page(site), /class="thumb"/, bad)
    }
    site.services[0].photo = `https://app.ikizy.com/api/photo?id=${PHOTO}`
    assert.match(page(site), /class="thumb" src="https:\/\/app\.ikizy\.com\/api\/photo\?id=/)
  })

  it('texto do produto nunca vira HTML', () => {
    const evil = '<img src=x onerror=alert(1)>'
    const site = base()
    site.showcase = [{ name: evil, description: evil, price: 1, photo: null }]
    const html = page(site)
    assert.doesNotMatch(html, /<img src=x/)
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  })

  it('página 404 não é indexada', () => {
    assert.match(renderNotFound(), /name="robots" content="noindex"/)
  })
})

describe('estilo da capa', () => {
  const hero = (html: string) => html.match(/<section class="panel hero[^"]*"/)?.[0] ?? ''

  it('cada estilo vira uma classe na capa sem foto', () => {
    for (const id of ['poa', 'xadrez', 'editorial', 'organico']) {
      assert.match(hero(page(base({}, { cover_style: id }))), new RegExp('hero--' + id))
    }
  })

  it('sóbrio, vazio e valor desconhecido ficam sem classe de estilo', () => {
    for (const v of ['sobrio', '', 'neon', undefined]) {
      assert.equal(hero(page(base({}, { cover_style: v }))), '<section class="panel hero"')
    }
  })

  it('a foto de capa passa na frente do estilo', () => {
    const cover = 'data:image/png;base64,iVBORw0KGgo='
    assert.equal(hero(page(base({}, { cover_style: 'poa', cover }))), '<section class="panel hero hero--cover"')
  })

  it('a folha de estilos traz os cinco estilos usando só variáveis da paleta', () => {
    const html = page(base({}, { cover_style: 'xadrez' }))
    for (const id of ['poa', 'xadrez', 'editorial', 'organico']) assert.ok(html.includes('.hero--' + id + ':not(.hero--cover)'))
  })
})

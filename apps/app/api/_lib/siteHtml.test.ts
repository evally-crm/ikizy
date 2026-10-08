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

  it('cor de destaque desconhecida cai no bordô', () => {
    assert.match(page(base({}, { accent: 'neon' })), /--accent:#460106/)
    assert.match(page(base({}, { accent: 'rubi' })), /--accent:#bf0c22/)
  })

  it('cor própria vale no lugar da lista; cor clara demais é escurecida para o texto branco', () => {
    assert.match(page(base({}, { accent: 'rubi', accent_color: '#1a7f5a' })), /--accent:#1a7f5a/)
    const light = page(base({}, { accent_color: '#ffff00' })).match(/--accent:(#[0-9a-f]{6})/)?.[1]
    assert.ok(light && light !== '#ffff00')
    assert.match(page(base({}, { accent: 'rubi', accent_color: 'vermelho' })), /--accent:#bf0c22/)
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

  it('página 404 não é indexada', () => {
    assert.match(renderNotFound(), /name="robots" content="noindex"/)
  })
})

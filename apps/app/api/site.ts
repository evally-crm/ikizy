import { reportError } from './_lib/monitoring.js'
import { isReservedSlug } from '../src/lib/slug.js'
import { renderNotFound, renderSiteOffline, renderSitePage } from './_lib/siteHtml.js'
import { appUrl, fetchOfflineSiteName, fetchPublicSite } from './_lib/runtime.js'

const html = (body: string, status: number, cache: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache } })

/** GET /api/site?slug=nome -> página pública do negócio (chamada por /s/nome e por nome.ikizy.com) */
export async function GET(request: Request) {
  const slug = (new URL(request.url).searchParams.get('slug') ?? '').toLowerCase()
  const valid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 40 && !isReservedSlug(slug)
  if (!valid) return html(renderNotFound(), 404, 'public, s-maxage=60')

  try {
    const site = await fetchPublicSite(slug)
    if (!site) {
      // publicado mas fora do ar (acesso vencido há mais de 7 dias): aviso neutro; 503 diz aos buscadores que é temporário
      // se a migration 20261117120000 ainda não rodou neste banco, cai no 404 de sempre
      const offline = await fetchOfflineSiteName(slug).catch((error) => (reportError(error, `site fora do ar ${slug}`), null))
      if (offline) return html(renderSiteOffline(offline), 503, 'public, s-maxage=60')
      return html(renderNotFound(), 404, 'public, s-maxage=30')
    }
    const page = renderSitePage(site, { canonical: `${appUrl()}/s/${slug}`, captchaSiteKey: process.env.TURNSTILE_SITE_KEY })
    // cache curto: a edição publicada aparece em até 1 minuto
    return html(page, 200, 'public, s-maxage=60')
  } catch (error) {
    reportError(error, `site ${slug}`)
    return html(renderNotFound(), 500, 'no-store')
  }
}

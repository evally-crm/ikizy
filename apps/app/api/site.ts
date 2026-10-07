import { isReservedSlug } from '../src/lib/slug.js'
import { renderNotFound, renderSitePage } from './_lib/siteHtml.js'
import { appUrl, fetchPublicSite } from './_lib/runtime.js'

const html = (body: string, status: number, cache: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache } })

/** GET /api/site?slug=nome -> página pública do negócio (chamada por /s/nome e por nome.ikizy.com) */
export async function GET(request: Request) {
  const slug = (new URL(request.url).searchParams.get('slug') ?? '').toLowerCase()
  const valid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 40 && !isReservedSlug(slug)
  if (!valid) return html(renderNotFound(), 404, 'public, s-maxage=60')

  try {
    const site = await fetchPublicSite(slug)
    if (!site) return html(renderNotFound(), 404, 'public, s-maxage=30')
    const page = renderSitePage(site, { canonical: `${appUrl()}/s/${slug}` })
    // cache curto: a edição publicada aparece em até 1 minuto
    return html(page, 200, 'public, s-maxage=60, stale-while-revalidate=600')
  } catch (error) {
    console.error('site', slug, error)
    return html(renderNotFound(), 500, 'no-store')
  }
}

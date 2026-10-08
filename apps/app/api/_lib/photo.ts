const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/

/** id da foto na URL (?id=...); null se não for um uuid */
export function parsePhotoId(url: URL): string | null {
  const id = url.searchParams.get('id') ?? ''
  return UUID.test(id) ? id.toLowerCase() : null
}

/** data URL guardada no banco -> bytes e tipo; null se o formato não for o esperado */
export function decodePhoto(data: string | null | undefined): { type: string; bytes: Uint8Array } | null {
  const m = typeof data === 'string' ? DATA_URL.exec(data) : null
  if (!m) return null
  return { type: m[1], bytes: new Uint8Array(Buffer.from(m[2], 'base64')) }
}

/** caminho público de uma foto (o id nunca se repete: foto nova = id novo, por isso o cache pode ser eterno) */
export const photoPath = (id: string) => `/api/photo?id=${id}`

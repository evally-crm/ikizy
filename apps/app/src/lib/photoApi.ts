import { neon } from './neon'

/**
 * fotos na loja privada (Vercel Blob), pelo servidor: /api/photos/upload grava, /api/photos/file entrega.
 * No ambiente local as funções de servidor não existem; aí `uploadPhoto` devolve null e quem chamou
 * guarda a foto do jeito antigo (data URL no banco), que continua aceito.
 */

export type PhotoScope = 'site' | 'client'

async function token(): Promise<string | null> {
  const { data } = (await neon?.auth.getSession()) ?? { data: { session: null } }
  return data.session?.access_token ?? null
}

export class PhotoError extends Error {}

/** grava a foto (e a miniatura, nas de cliente); null = servidor indisponível (ambiente local) */
export async function uploadPhoto(salonId: string, scope: PhotoScope, image: string, thumb?: string): Promise<{ path: string; thumbPath: string | null } | null> {
  const t = await token()
  if (!t) throw new PhotoError('Entre na sua conta para continuar.')
  let res: Response
  try {
    res = await fetch('/api/photos/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
      body: JSON.stringify({ salonId, scope, image, thumb }),
    })
  } catch {
    throw new PhotoError('Sem conexão. Verifique sua internet e tente de novo.')
  }
  if (res.status === 404 || res.status === 405) return null
  const payload = (await res.json().catch(() => null)) as { path?: string; thumbPath?: string | null; message?: string } | null
  if (!res.ok || !payload?.path) throw new PhotoError(payload?.message ?? 'Não foi possível salvar a foto. Tente de novo.')
  return { path: payload.path, thumbPath: payload.thumbPath ?? null }
}

const urls = new Map<string, Promise<string>>()

/** endereço local (blob:) de uma foto da loja, buscada com o login; fica guardado enquanto a página está aberta */
export function photoFileUrl(path: string): Promise<string> {
  let hit = urls.get(path)
  if (!hit) {
    hit = (async () => {
      const t = await token()
      const res = await fetch(`/api/photos/file?path=${encodeURIComponent(path)}`, { headers: t ? { authorization: `Bearer ${t}` } : {} })
      if (!res.ok) throw new PhotoError('Não foi possível abrir a foto.')
      return URL.createObjectURL(await res.blob())
    })()
    hit.catch(() => urls.delete(path))
    urls.set(path, hit)
  }
  return hit
}

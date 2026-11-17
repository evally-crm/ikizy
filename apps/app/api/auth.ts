import { proxyAuth } from './_lib/authProxy.js'
import { fail } from './_lib/runtime.js'
import { HttpError } from './_lib/billing.js'

// /api/auth/<caminho> chega aqui como /api/auth?p=<caminho> (vercel.json); veja _lib/authProxy.ts
async function handle(request: Request) {
  try {
    const base = process.env.NEON_AUTH_BASE_URL
    if (!base) throw new HttpError(500, 'no_auth', 'O login não está configurado.')
    return await proxyAuth(request, { base })
  } catch (error) {
    return fail(error)
  }
}

export const GET = handle
export const POST = handle

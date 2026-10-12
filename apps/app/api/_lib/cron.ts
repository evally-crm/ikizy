import { timingSafeEqual } from 'node:crypto'
import { HttpError } from './billing.js'

/** o que as tarefas automáticas precisam do banco (a implementação real fica em runtime.ts) */
export interface CronDb {
  /** pedidos do site que passaram do horário sem resposta viram cancelados; devolve quantos */
  expireStaleRequests(): Promise<number>
}

/**
 * confere o cabeçalho que o cron da Vercel manda (`Authorization: Bearer <CRON_SECRET>`).
 * Sem segredo configurado, nada roda: a rota nunca fica aberta por esquecimento.
 */
export function assertCronAuthorized(header: string | null, secret: string | undefined): void {
  if (!secret) throw new HttpError(503, 'cron_not_configured', 'Tarefas automáticas não configuradas.')
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(header ?? '')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new HttpError(401, 'unauthorized', 'Não autorizado.')
  }
}

export async function runExpireRequests(db: CronDb): Promise<{ expired: number }> {
  return { expired: await db.expireStaleRequests() }
}

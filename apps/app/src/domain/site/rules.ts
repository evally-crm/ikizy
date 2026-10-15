/** limites do que o salão pode configurar no site */
export const SITE_LIMITS = {
  plans: 6,
  planIncludes: 8,
  showcase: 24,
  noticeHours: 168,
  windowDays: 90,
  depositPercent: 100,
} as const

/** valor digitado ("12,5" ou "12.5") como número não negativo; texto inválido vira 0 */
export const parseAmount = (text: string) => Math.max(0, Number(text.replace(',', '.')) || 0)

/** endereço da página: só letras minúsculas, números e hífen */
export const cleanSlug = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9-]/g, '')

const whole = (raw: string) => Math.round(parseAmount(raw))

/** antecedência mínima do agendamento online, em horas (0 a 168) */
export const noticeHours = (raw: string) => Math.min(SITE_LIMITS.noticeHours, whole(raw))

/** até quantos dias à frente se pode agendar (1 a 90) */
export const windowDays = (raw: string) => Math.min(SITE_LIMITS.windowDays, Math.max(1, whole(raw)))

/** sinal cobrado no agendamento online, em % (0 a 100; 0 = não cobra) */
export const depositPercent = (raw: string) => Math.min(SITE_LIMITS.depositPercent, whole(raw))

/** itens "o que inclui" de um plano: uma linha por item, no máximo 8 */
export const splitIncludes = (text: string) => text.split('\n').slice(0, SITE_LIMITS.planIncludes)

export interface PublishState {
  isLive: boolean
  dirty: boolean
  justPublished: boolean
  publishing: boolean
  loading: boolean
  /** o endereço escolhido é reservado */
  reserved: boolean
}

/**
 * o botão de publicar: texto e se está desligado.
 * `header` (topo, computador) fala por extenso; `compact` (barra de cima do celular) usa uma palavra só.
 */
export function publishButton(s: PublishState, variant: 'header' | 'compact'): { label: string; disabled: boolean } {
  const disabled = (!s.dirty && !s.justPublished && s.isLive) || s.reserved || s.publishing || s.loading
  if (variant === 'compact') {
    return { label: s.publishing ? 'Publicando…' : s.justPublished || (s.isLive && !s.dirty) ? 'Publicado' : 'Publicar', disabled }
  }
  return {
    label: s.publishing ? 'Publicando…' : s.justPublished ? 'Publicado!' : !s.isLive ? 'Publicar site' : s.dirty ? 'Publicar alterações' : 'Tudo publicado',
    disabled,
  }
}

/** há algo ainda não publicado (o site nunca foi ao ar ou tem alterações): o botão ganha um pontinho */
export const hasPendingPublish = (s: PublishState) => !s.publishing && !s.justPublished && (s.dirty || !s.isLive)

/** índice dentro de uma lista de `length` itens: -1 ou fora do fim vira o item mais próximo */
export const clampIndex = (index: number, length: number) => Math.max(0, Math.min(length - 1, index))

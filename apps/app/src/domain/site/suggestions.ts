import { SEGMENTS, type Segment, type SuggestedService } from '../../lib/segments'

/** o mínimo de um serviço já cadastrado que a sugestão precisa olhar */
interface Registered {
  name: string
  category: string
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * áreas do negócio, deduzidas do que já está cadastrado (o cadastro não guarda as áreas marcadas):
 * a área de um serviço com o mesmo nome de uma sugestão, ou a primeira área de uma categoria usada
 * (ex.: "Cabelo" para quem tem um serviço próprio na categoria Cabelo, e não "Barbearia").
 */
export function businessAreas(services: Registered[], segments: Segment[] = SEGMENTS): Segment[] {
  const names = new Set(services.map((s) => fold(s.name)))
  const byName = segments.filter((seg) => seg.services.some((x) => names.has(fold(x.name))))
  const covered = new Set(byName.map((seg) => seg.category))
  const byCategory = segments.filter(
    (seg, i) => !covered.has(seg.category) && services.some((s) => s.category === seg.category) && segments.findIndex((o) => o.category === seg.category) === i,
  )
  return segments.filter((seg) => byName.includes(seg) || byCategory.includes(seg))
}

/** serviços prontos de uma área que ainda não estão cadastrados (pelo nome, sem ligar para acento e maiúscula) */
export function missingSuggestions(segment: Segment, services: Registered[]): SuggestedService[] {
  const names = new Set(services.map((s) => fold(s.name)))
  return segment.services.filter((x) => !names.has(fold(x.name)))
}

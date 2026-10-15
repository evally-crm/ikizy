import { OTHER_SEGMENT, SEGMENTS, STARTER_PER_SEGMENT, type Segment } from '../../lib/segments'

/** duração de quem digita um serviço novo no cadastro; ajusta depois em Meu negócio */
export const ADDED_DURATION = 60

/** teto de serviços criados no cadastro (o banco recusa mais que isso) */
export const MAX_STARTER_SERVICES = 40

export interface ServiceChange {
  /** área (segmento) em que o serviço fica */
  segment: string
  name: string
}

export interface ReviewGroup {
  segment: string
  /** título do grupo: o nome da área, ou o que a pessoa digitou em "Outro" */
  label: string
  services: { name: string; duration: number }[]
}

export interface StarterService {
  name: string
  category: Segment['category']
  price: number
  duration: number
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
const sameName = (a: string, b: string) => fold(a) === fold(b)

const segmentById = (id: string) => (id === OTHER_SEGMENT.id ? OTHER_SEGMENT : SEGMENTS.find((s) => s.id === id))

/**
 * serviços para revisar, por área marcada: os mais comuns de cada área, menos os que a pessoa tirou,
 * mais os que ela digitou. Sem preço: os preços entram depois, já com a agenda na frente.
 */
export function reviewGroups(segments: string[], otherLabel: string, removed: ServiceChange[], added: ServiceChange[]): ReviewGroup[] {
  const order = [...SEGMENTS.map((s) => s.id), OTHER_SEGMENT.id]
  return order
    .filter((id) => segments.includes(id))
    .map((id) => {
      const seg = segmentById(id)!
      const isRemoved = (name: string) => removed.some((r) => r.segment === id && sameName(r.name, name))
      const starter = seg.services
        .slice(0, STARTER_PER_SEGMENT)
        .filter((s) => !isRemoved(s.name))
        .map((s) => ({ name: s.name, duration: s.duration }))
      const extra = added.filter((x) => x.segment === id && !isRemoved(x.name)).map((x) => ({ name: x.name.trim(), duration: ADDED_DURATION }))
      return {
        segment: id,
        label: id === OTHER_SEGMENT.id ? otherLabel.trim() || OTHER_SEGMENT.label : seg.label,
        services: [...starter, ...extra],
      }
    })
}

/** tirar um serviço da lista (e esquecer se tinha sido digitado) */
export function removeService(removed: ServiceChange[], added: ServiceChange[], change: ServiceChange) {
  const wasAdded = added.some((x) => x.segment === change.segment && sameName(x.name, change.name))
  return {
    removed: wasAdded ? removed : [...removed, change],
    added: added.filter((x) => !(x.segment === change.segment && sameName(x.name, change.name))),
  }
}

/**
 * pôr um serviço digitado; devolve o erro para mostrar (nome curto, longo ou repetido) ou as listas novas.
 * Um serviço comum que tinha sido tirado volta para a lista.
 */
export function addService(
  groups: ReviewGroup[],
  removed: ServiceChange[],
  added: ServiceChange[],
  change: ServiceChange,
): { error: string } | { removed: ServiceChange[]; added: ServiceChange[] } {
  const name = change.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2) return { error: 'Escreva o nome do serviço.' }
  if (name.length > 80) return { error: 'Use até 80 letras no nome do serviço.' }
  const group = groups.find((g) => g.segment === change.segment)
  if (group?.services.some((s) => sameName(s.name, name))) return { error: 'Esse serviço já está na lista.' }
  if (groups.reduce((n, g) => n + g.services.length, 0) >= MAX_STARTER_SERVICES) {
    return { error: `Coloque até ${MAX_STARTER_SERVICES} serviços agora. O resto você cadastra depois, em Meu negócio.` }
  }
  const back = removed.filter((r) => !(r.segment === change.segment && sameName(r.name, name)))
  if (back.length < removed.length) return { removed: back, added }
  return { removed, added: [...added, { segment: change.segment, name }] }
}

/** quantos serviços vão ser criados */
export const serviceCount = (groups: ReviewGroup[]) => groups.reduce((n, g) => n + g.services.length, 0)

/** o que vai para o banco: serviços sem preço, na categoria da área */
export function starterFromGroups(groups: ReviewGroup[]): StarterService[] {
  return groups
    .flatMap((g) => g.services.map((s) => ({ name: s.name, category: segmentById(g.segment)!.category, price: 0, duration: s.duration })))
    .slice(0, MAX_STARTER_SERVICES)
}

/**
 * "Seu site em 10 min": o que falta para a página ficar pronta, e textos prontos para não começar do zero.
 */

export type QuickStepId = 'foto' | 'textos' | 'precos' | 'contato' | 'publicar'

export interface QuickStep {
  id: QuickStepId
  label: string
  done: boolean
}

interface QuickInput {
  site: { logo: string; cover: string; tagline: string; about: string; whatsapp: string; address: string }
  services: { price: number; visible: boolean }[]
  isLive: boolean
  dirty: boolean
}

/** as 5 etapas, na ordem em que vale a pena fazer */
export function quickSteps({ site, services, isLive, dirty }: QuickInput): QuickStep[] {
  const shown = services.filter((s) => s.visible)
  return [
    { id: 'foto', label: 'Foto de perfil ou capa', done: Boolean(site.logo || site.cover) },
    { id: 'textos', label: 'Frase de apresentação', done: Boolean(site.tagline.trim() || site.about.trim()) },
    { id: 'precos', label: 'Serviços com preço', done: shown.length > 0 && shown.every((s) => s.price > 0) },
    { id: 'contato', label: 'WhatsApp e endereço', done: Boolean(site.whatsapp.trim() && site.address.trim()) },
    { id: 'publicar', label: 'Publicar', done: isLive && !dirty },
  ]
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`

/**
 * horário do site a partir da agenda (todas as profissionais juntas): "Seg a Sáb · 09h às 19h".
 * Dias seguidos viram intervalo; soltos, lista ("Seg, Qua e Sex"). Vazio quando ninguém tem horário.
 */
export function hoursSummary(intervals: { weekday: number; start: number; end: number }[]): string {
  if (intervals.length === 0) return ''
  // semana começando na segunda, com o domingo no fim
  const order = (d: number) => (d + 6) % 7
  const days = [...new Set(intervals.map((i) => i.weekday))].sort((a, b) => order(a) - order(b))
  const start = Math.min(...intervals.map((i) => i.start))
  const end = Math.max(...intervals.map((i) => i.end))
  const run = days.every((d, i) => i === 0 || order(d) === order(days[i - 1]) + 1)
  const names = days.map((d) => DAYS[d])
  const when =
    names.length === 1 ? names[0] : run && names.length > 2 ? `${names[0]} a ${names[names.length - 1]}` : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
  return `${when} · ${clock(start)} às ${clock(end)}`
}

const TAGLINES: Record<string, string> = {
  Unhas: 'Unhas impecáveis, feitas para durar.',
  Cabelo: 'Cabelo bem cuidado, do corte à cor.',
  Cílios: 'Olhar marcante, do natural ao volume.',
  Sobrancelha: 'Sobrancelhas no formato do seu rosto.',
  Estética: 'Pele cuidada e corpo leve, com técnica.',
}

const GENERIC_TAGLINES = ['Seu momento de cuidado, sem pressa.', 'Beleza com hora marcada e atenção de verdade.', 'Cuidado de verdade, do começo ao fim.']

/** até 3 frases de destaque: as das áreas do negócio primeiro, depois as que servem para todos */
export function taglineIdeas(categories: string[]): string[] {
  const own = categories.map((c) => TAGLINES[c]).filter((t): t is string => Boolean(t))
  return [...new Set([...own, ...GENERIC_TAGLINES])].slice(0, 3)
}

/** "unhas, cílios e cabelo" */
const joinAreas = (categories: string[]) => {
  const list = categories.filter((c) => c !== 'Outros').map((c) => c.toLowerCase())
  if (list.length === 0) return 'beleza'
  return list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`
}

/** dois textos "sobre" prontos, com o nome e as áreas do negócio (até 220 letras, o limite do campo) */
export function aboutIdeas(name: string, categories: string[]): string[] {
  const areas = joinAreas(categories)
  const who = name.trim() || 'Nosso espaço'
  return [
    `${who} é um espaço de ${areas} pensado para você se sentir bem. Atendimento com hora marcada, produtos de qualidade e cuidado em cada detalhe.`,
    `Aqui cada atendimento é feito com calma e atenção. Trabalhamos com ${areas}, materiais de qualidade e higiene em primeiro lugar. Agende pelo WhatsApp.`,
  ].map((t) => t.slice(0, 220))
}

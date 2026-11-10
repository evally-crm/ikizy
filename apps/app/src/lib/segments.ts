import type { Category } from './siteTheme'

export interface SuggestedService {
  id: string
  name: string
  /** duração sugerida em minutos; é só um ponto de partida, a pessoa ajusta no painel */
  duration: number
}

export interface Segment {
  id: string
  label: string
  /** categoria do catálogo em que os serviços entram */
  category: Category
  services: SuggestedService[]
}

/** segmentos do setor de beleza e os serviços mais comuns de cada um. Sem preços: cada negócio define os seus. */
export const SEGMENTS: Segment[] = [
  {
    id: 'cabelo',
    label: 'Cabelo',
    category: 'Cabelo',
    services: [
      { id: 'corte-feminino', name: 'Corte feminino', duration: 60 },
      { id: 'escova', name: 'Escova', duration: 45 },
      { id: 'hidratacao', name: 'Hidratação', duration: 60 },
      { id: 'coloracao', name: 'Coloração', duration: 150 },
      { id: 'mechas', name: 'Mechas', duration: 240 },
      { id: 'alisamento', name: 'Alisamento', duration: 180 },
      { id: 'penteado', name: 'Penteado', duration: 60 },
      { id: 'botox-capilar', name: 'Botox capilar', duration: 120 },
      { id: 'selagem', name: 'Selagem', duration: 150 },
      { id: 'cauterizacao', name: 'Cauterização', duration: 90 },
      { id: 'reconstrucao', name: 'Reconstrução capilar', duration: 90 },
      { id: 'corte-infantil', name: 'Corte infantil', duration: 30 },
    ],
  },
  {
    id: 'barbearia',
    label: 'Barbearia',
    category: 'Cabelo',
    services: [
      { id: 'corte-masculino', name: 'Corte masculino', duration: 40 },
      { id: 'barba', name: 'Barba', duration: 30 },
      { id: 'corte-barba', name: 'Corte e barba', duration: 60 },
      { id: 'pezinho', name: 'Pezinho', duration: 15 },
      { id: 'sobrancelha-masculina', name: 'Sobrancelha masculina', duration: 15 },
      { id: 'barboterapia', name: 'Barboterapia', duration: 45 },
      { id: 'platinado', name: 'Platinado', duration: 120 },
      { id: 'relaxamento', name: 'Relaxamento', duration: 45 },
    ],
  },
  {
    id: 'unhas',
    label: 'Unhas',
    category: 'Unhas',
    services: [
      { id: 'gel', name: 'Esmaltação em gel', duration: 60 },
      { id: 'alongamento', name: 'Alongamento em gel', duration: 120 },
      { id: 'manutencao-unhas', name: 'Manutenção de alongamento', duration: 90 },
      { id: 'mao-pe', name: 'Mão e pé', duration: 100 },
      { id: 'manicure', name: 'Manicure', duration: 45 },
      { id: 'pedicure', name: 'Pedicure', duration: 60 },
      { id: 'nail-art', name: 'Nail art', duration: 45 },
      { id: 'banho-gel', name: 'Banho de gel', duration: 75 },
      { id: 'blindagem', name: 'Blindagem', duration: 60 },
      { id: 'spa-pes', name: 'Spa dos pés', duration: 60 },
      { id: 'remocao-gel', name: 'Remoção de gel', duration: 30 },
    ],
  },
  {
    id: 'cilios',
    label: 'Cílios',
    category: 'Cílios',
    services: [
      { id: 'fio-a-fio', name: 'Fio a fio', duration: 120 },
      { id: 'volume-russo', name: 'Volume russo', duration: 150 },
      { id: 'lash-lifting', name: 'Lash lifting', duration: 75 },
      { id: 'manutencao-cilios', name: 'Manutenção de cílios', duration: 75 },
      { id: 'remocao-cilios', name: 'Remoção de extensão', duration: 30 },
      { id: 'volume-brasileiro', name: 'Volume brasileiro', duration: 120 },
      { id: 'volume-egipcio', name: 'Volume egípcio', duration: 120 },
      { id: 'manutencao-volume', name: 'Manutenção de volume', duration: 90 },
      { id: 'tintura-cilios', name: 'Tintura de cílios', duration: 20 },
    ],
  },
  {
    id: 'sobrancelha',
    label: 'Sobrancelha',
    category: 'Sobrancelha',
    services: [
      { id: 'design-sobrancelha', name: 'Design de sobrancelha', duration: 40 },
      { id: 'design-henna', name: 'Design com henna', duration: 50 },
      { id: 'brow-lamination', name: 'Brow lamination', duration: 60 },
      { id: 'buco', name: 'Depilação de buço', duration: 15 },
      { id: 'micropigmentacao', name: 'Micropigmentação', duration: 150 },
      { id: 'retoque-micro', name: 'Retoque de micropigmentação', duration: 90 },
      { id: 'epilacao-linha', name: 'Epilação com linha', duration: 30 },
      { id: 'tintura-sobrancelha', name: 'Tintura de sobrancelha', duration: 20 },
    ],
  },
  {
    id: 'estetica',
    label: 'Estética',
    category: 'Estética',
    services: [
      { id: 'limpeza-pele', name: 'Limpeza de pele', duration: 75 },
      { id: 'massagem', name: 'Massagem relaxante', duration: 60 },
      { id: 'depilacao-cera', name: 'Depilação a cera', duration: 45 },
      { id: 'drenagem', name: 'Drenagem linfática', duration: 60 },
      { id: 'peeling', name: 'Peeling', duration: 45 },
      { id: 'microagulhamento', name: 'Microagulhamento', duration: 60 },
      { id: 'revitalizacao', name: 'Revitalização facial', duration: 60 },
      { id: 'modeladora', name: 'Massagem modeladora', duration: 60 },
      { id: 'ventosaterapia', name: 'Ventosaterapia', duration: 50 },
      { id: 'depilacao-laser', name: 'Depilação a laser', duration: 30 },
    ],
  },
]

/** "Outro": área fora da lista; a pessoa digita o nome e os serviços, que entram na categoria "Outros" */
export const OTHER_SEGMENT: Segment = { id: 'outro', label: 'Outro', category: 'Outros', services: [] }

/** quantos serviços de cada área entram no catálogo inicial (os primeiros da lista são os mais comuns) */
export const STARTER_PER_SEGMENT = 4

/** catálogo inicial das áreas marcadas: sem preço, que a pessoa define nos primeiros passos */
export const starterServices = (segmentIds: string[]) =>
  SEGMENTS.filter((s) => segmentIds.includes(s.id)).flatMap((s) =>
    s.services.slice(0, STARTER_PER_SEGMENT).map((x) => ({ name: x.name, category: s.category, price: 0, duration: x.duration })),
  )

/** horário inicial de quem atende: segunda a sábado, das 9h às 19h (ajustado nos primeiros passos) */
export const STARTER_HOURS = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start_minute: 9 * 60, end_minute: 19 * 60 }))

/** o que o cadastro monta no negócio logo depois de criá-lo */
export interface SalonSetup {
  services: { name: string; category: Category; price: number; duration: number }[]
  /** a dona entra na agenda como profissional (com ou sem equipe; se não atende, desativa depois) */
  professionalName: string
  /** plano do teste grátis: Só eu → Solo, Eu e equipe → Studio, ou o que veio do site */
  plan: 'solo' | 'studio' | 'salao'
  /** horário de atendimento da dona (sem ele, vale STARTER_HOURS) */
  hours?: { weekday: number; start_minute: number; end_minute: number }[]
}

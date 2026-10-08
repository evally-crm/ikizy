/** ficha de anamnese: perguntas fixas, agrupadas, pensadas para unhas, cílios, sobrancelha, cabelo e estética */

export interface AnamnesisAnswer {
  /** true = sim, false = não; sem a chave = não perguntado ainda */
  yes: boolean
  /** detalhe quando a resposta é sim (qual remédio, qual cirurgia...) */
  detail?: string
}

export interface Anamnesis {
  answers: Record<string, AnamnesisAnswer>
  /** observações livres da avaliação */
  notes: string
}

export interface AnamnesisQuestion {
  id: string
  text: string
  /** o que pedir quando a resposta é sim */
  ask?: string
}

export const ANAMNESIS_GROUPS: { title: string; questions: AnamnesisQuestion[] }[] = [
  {
    title: 'Saúde',
    questions: [
      { id: 'gestante', text: 'Está grávida ou amamentando?' },
      { id: 'medicamento', text: 'Usa algum medicamento contínuo?', ask: 'Quais?' },
      { id: 'acidos', text: 'Usa ácidos na pele ou isotretinoína (Roacutan)?', ask: 'Qual e desde quando?' },
      { id: 'diabetes', text: 'Tem diabetes?' },
      { id: 'pressao', text: 'Tem pressão alta ou baixa?' },
      { id: 'circulacao', text: 'Tem problema de circulação ou coagulação?', ask: 'Qual?' },
      { id: 'cardiaco', text: 'Tem problema no coração ou usa marca-passo?' },
      { id: 'epilepsia', text: 'Tem epilepsia ou já teve convulsões?' },
      { id: 'hormonal', text: 'Tem alteração hormonal ou de tireoide?', ask: 'Qual?' },
      { id: 'pele', text: 'Tem doença de pele (dermatite, psoríase, herpes, vitiligo)?', ask: 'Qual?' },
      { id: 'cirurgia', text: 'Fez cirurgia ou procedimento estético nos últimos 6 meses?', ask: 'Qual e quando?' },
    ],
  },
  {
    title: 'Olhos, cílios e sobrancelha',
    questions: [
      { id: 'lentes', text: 'Usa lentes de contato?' },
      { id: 'olhos', text: 'Tem sensibilidade, conjuntivite ou cirurgia recente nos olhos?', ask: 'O quê?' },
      { id: 'queda', text: 'Tem queda de cílios ou de sobrancelha?' },
    ],
  },
  {
    title: 'Unhas e cabelo',
    questions: [
      { id: 'unhas', text: 'Tem micose, unhas frágeis ou feridas nas cutículas?', ask: 'Onde?' },
      { id: 'quimica', text: 'Fez química no cabelo nos últimos 3 meses?', ask: 'Qual (progressiva, coloração, descoloração)?' },
      { id: 'couro', text: 'Tem sensibilidade, caspa ou ferida no couro cabeludo?' },
    ],
  },
  {
    title: 'Hábitos',
    questions: [
      { id: 'sensivel', text: 'Tem a pele sensível ou que fica vermelha fácil?' },
      { id: 'sol', text: 'Toma sol com frequência?' },
      { id: 'fumante', text: 'Fuma?' },
    ],
  },
]

const ALL = ANAMNESIS_GROUPS.flatMap((g) => g.questions)
export const ANAMNESIS_TOTAL = ALL.length

export const emptyAnamnesis = (): Anamnesis => ({ answers: {}, notes: '' })

/** lê o jsonb do banco sem confiar no formato */
export function parseAnamnesis(raw: unknown): Anamnesis {
  const out = emptyAnamnesis()
  if (!raw || typeof raw !== 'object') return out
  const obj = raw as { answers?: unknown; notes?: unknown }
  if (typeof obj.notes === 'string') out.notes = obj.notes
  if (obj.answers && typeof obj.answers === 'object') {
    for (const q of ALL) {
      const a = (obj.answers as Record<string, unknown>)[q.id] as { yes?: unknown; detail?: unknown } | undefined
      if (a && typeof a.yes === 'boolean') out.answers[q.id] = { yes: a.yes, detail: typeof a.detail === 'string' ? a.detail : undefined }
    }
  }
  return out
}

export const answeredCount = (a: Anamnesis) => ALL.filter((q) => q.id in a.answers).length

/** pontos de atenção para o atendimento (todo "sim" pede cuidado), em frases curtas */
export function attentionPoints(a: Anamnesis): string[] {
  return ALL.flatMap((q) => {
    const ans = a.answers[q.id]
    if (!ans?.yes) return []
    const label = ATTENTION_LABEL[q.id] ?? q.text
    return [ans.detail?.trim() ? `${label}: ${ans.detail.trim()}` : label]
  })
}

const ATTENTION_LABEL: Record<string, string> = {
  gestante: 'Grávida ou amamentando',
  medicamento: 'Usa medicamento contínuo',
  acidos: 'Usa ácidos ou isotretinoína',
  diabetes: 'Diabetes',
  pressao: 'Pressão alta ou baixa',
  circulacao: 'Circulação ou coagulação',
  cardiaco: 'Problema cardíaco ou marca-passo',
  epilepsia: 'Epilepsia',
  hormonal: 'Alteração hormonal',
  pele: 'Doença de pele',
  cirurgia: 'Cirurgia ou procedimento recente',
  lentes: 'Usa lentes de contato',
  olhos: 'Sensibilidade nos olhos',
  queda: 'Queda de cílios ou sobrancelha',
  unhas: 'Unhas ou cutículas sensíveis',
  quimica: 'Química recente no cabelo',
  couro: 'Couro cabeludo sensível',
  sol: 'Toma sol com frequência',
  sensivel: 'Pele sensível',
  fumante: 'Fumante',
}

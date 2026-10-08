/**
 * Campanhas de oferta pelo WhatsApp do salão. Usado pelo navegador E pelas funções de servidor (api/),
 * então não pode importar nada do React nem do DOM. O servidor monta o texto de cada cliente a partir
 * daqui: o navegador escolhe o modelo e preenche os campos, nunca manda o texto pronto.
 */

/** campanha só vale a partir de 10 clientes; com menos, o salão usa a mensagem pronta (wa.me) */
export const MIN_RECIPIENTS = 10
/** acima disso o risco de o WhatsApp bloquear o número cresce muito */
export const MAX_RECIPIENTS = 150
/** campanhas grátis por mês, por salão */
export const FREE_CAMPAIGNS_PER_MONTH = 1
/** preço de cada campanha extra, em centavos de real */
export const EXTRA_CAMPAIGN_CENTS = 990
/** quantas extras dá para comprar de uma vez */
export const EXTRA_CAMPAIGN_PACKS = [1, 3] as const
export type ExtraPack = (typeof EXTRA_CAMPAIGN_PACKS)[number]
export const isExtraPack = (v: unknown): v is ExtraPack => EXTRA_CAMPAIGN_PACKS.includes(v as ExtraPack)

/** intervalo aleatório entre uma mensagem e a próxima (segundos) e horário em que o envio acontece (São Paulo) */
export const GAP_SECONDS = { min: 45, max: 90 } as const
export const SEND_HOURS = { from: 8, to: 20 } as const

/** respostas que tiram a cliente da lista de ofertas */
export const OPT_OUT_WORDS = ['sair', 'parar', 'pare', 'stop', 'cancelar', 'descadastrar', 'nao quero']
export const OPT_OUT_LINE = 'Para não receber mais ofertas, responda SAIR.'

// ---------------------------------------------------------------- modelos

export type FieldId = 'servico' | 'preco' | 'desconto' | 'validade' | 'extra'

export interface OfferFields {
  servico?: string
  /** em reais, ex.: "89,90" */
  preco?: string
  /** % de desconto */
  desconto?: string
  /** yyyy-MM-dd */
  validade?: string
  /** frase a mais, opcional */
  extra?: string
}

export type TemplateId = 'promocao' | 'desconto' | 'novidade' | 'horarios'

export interface OfferTemplate {
  id: TemplateId
  label: string
  hint: string
  required: FieldId[]
  optional: FieldId[]
}

export const OFFER_TEMPLATES: Record<TemplateId, OfferTemplate> = {
  promocao: { id: 'promocao', label: 'Preço especial', hint: 'Um serviço por um preço promocional', required: ['servico', 'preco', 'validade'], optional: ['extra'] },
  desconto: { id: 'desconto', label: 'Desconto', hint: 'Uma porcentagem de desconto num serviço', required: ['servico', 'desconto', 'validade'], optional: ['extra'] },
  novidade: { id: 'novidade', label: 'Novidade', hint: 'Um serviço novo no salão', required: ['servico'], optional: ['preco', 'extra'] },
  horarios: { id: 'horarios', label: 'Horários livres', hint: 'Agenda com vagas nos próximos dias', required: ['validade'], optional: ['servico', 'extra'] },
}
export const TEMPLATE_IDS = Object.keys(OFFER_TEMPLATES) as TemplateId[]
export const isTemplateId = (v: unknown): v is TemplateId => typeof v === 'string' && v in OFFER_TEMPLATES

export const FIELD_LABEL: Record<FieldId, string> = {
  servico: 'Serviço',
  preco: 'Preço (R$)',
  desconto: 'Desconto (%)',
  validade: 'Válido até',
  extra: 'Frase a mais (opcional)',
}
const FIELD_MAX: Record<FieldId, number> = { servico: 60, preco: 10, desconto: 2, validade: 10, extra: 160 }

/** limpa e confere os campos; devolve o erro em português (para a tela e para o servidor) */
export function validateOffer(template: TemplateId, raw: Record<string, unknown>): { fields: OfferFields; error: string | null } {
  const t = OFFER_TEMPLATES[template]
  const fields: OfferFields = {}
  for (const id of [...t.required, ...t.optional]) {
    const v = typeof raw[id] === 'string' ? (raw[id] as string) : ''
    // tudo numa linha só, sem espaços repetidos: o texto da mensagem é do modelo, não do campo
    const clean = v.replace(/\s+/g, ' ').trim().slice(0, FIELD_MAX[id])
    if (clean) fields[id] = clean
  }
  for (const id of t.required) {
    if (!fields[id]) return { fields, error: `Preencha: ${FIELD_LABEL[id].replace(' (opcional)', '')}.` }
  }
  if (fields.preco !== undefined && !/^\d{1,5}([.,]\d{1,2})?$/.test(fields.preco)) return { fields, error: 'Preço inválido. Use só números, ex.: 89,90.' }
  if (fields.desconto !== undefined && !(/^\d{1,2}$/.test(fields.desconto) && Number(fields.desconto) >= 5)) {
    return { fields, error: 'Desconto inválido. Use de 5 a 99%.' }
  }
  if (fields.validade !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(fields.validade)) return { fields, error: 'Data inválida.' }
  return { fields, error: null }
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const dayMonth = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} de ${MONTHS[m - 1] ?? ''}`
}
const money = (preco: string) => {
  const [int, dec = ''] = preco.replace('.', ',').split(',')
  return `R$ ${int},${dec.padEnd(2, '0')}`
}
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

/** texto final para uma cliente; sempre termina com a opção de sair */
export function renderOffer(template: TemplateId, f: OfferFields, ctx: { clientName: string; salonName: string; siteUrl?: string }): string {
  const nome = firstName(ctx.clientName)
  const salao = ctx.salonName || 'o salão'
  const ate = f.validade ? dayMonth(f.validade) : ''
  const extra = f.extra ? `\n\n${f.extra}` : ''
  const agendar = ctx.siteUrl ? `\n\nPara agendar: ${ctx.siteUrl}` : '\n\nQuer garantir seu horário? É só responder aqui.'

  let body: string
  switch (template) {
    case 'promocao':
      body = `Oi, ${nome}! 💕 Tem preço especial aqui no ${salao}:\n\n✨ ${f.servico} por ${money(f.preco ?? '0')}\n\nVálido até ${ate}.`
      break
    case 'desconto':
      body = `Oi, ${nome}! 💕 Separei um desconto para você no ${salao}:\n\n✨ ${f.desconto}% off em ${f.servico}\n\nVálido até ${ate}.`
      break
    case 'novidade':
      body = `Oi, ${nome}! Tem novidade no ${salao}: ✨ ${f.servico}${f.preco ? ` por ${money(f.preco)}` : ''}.\n\nVem conhecer?`
      break
    case 'horarios':
      body = `Oi, ${nome}! Abri alguns horários até ${ate}${f.servico ? ` para ${f.servico}` : ''}. 📅\n\nQuer reservar o seu antes que acabem?`
      break
  }
  return `${body}${extra}${agendar}\n\n${OPT_OUT_LINE}`
}

// ---------------------------------------------------------------- telefone

/** número no formato do WhatsApp (55 + DDD + número); null se não parece um celular/fixo do Brasil */
export function toWhatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits
  return null
}

/** o WhatsApp às vezes devolve o celular sem o 9 da frente: compara as duas formas */
export function phoneVariants(number: string): string[] {
  const n = number.replace(/\D/g, '')
  if (!n.startsWith('55')) return [n]
  const ddd = n.slice(2, 4)
  const rest = n.slice(4)
  if (rest.length === 9 && rest.startsWith('9')) return [n, `55${ddd}${rest.slice(1)}`]
  if (rest.length === 8) return [n, `55${ddd}9${rest}`]
  return [n]
}

/** "sair", "SAIR!", "Não quero" contam como pedido para sair */
export function isOptOut(text: string): boolean {
  const t = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return OPT_OUT_WORDS.includes(t)
}

// ---------------------------------------------------------------- estado para a tela

export type ExclusionReason = 'sem_whatsapp' | 'saiu' | 'ja_recebeu'

export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  sem_whatsapp: 'Sem WhatsApp',
  saiu: 'Pediu para sair',
  ja_recebeu: 'Já recebeu oferta este mês',
}

export interface CampaignQuota {
  usedFree: number
  credits: number
}

/** quantas campanhas o salão ainda pode fazer neste mês */
export const campaignsLeft = (q: CampaignQuota) => Math.max(0, FREE_CAMPAIGNS_PER_MONTH - q.usedFree) + q.credits

/** minutos aproximados para enviar N mensagens no ritmo seguro (o envio roda de minuto em minuto, uma por vez) */
export function estimateMinutes(count: number): number {
  return Math.ceil(Math.max(0, count - 1) * 1.5)
}

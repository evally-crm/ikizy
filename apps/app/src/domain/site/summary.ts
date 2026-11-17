/**
 * resumo depois de publicar: o que a cliente vai encontrar na página e o que ainda dá para melhorar.
 * Só regras; a janela só mostra.
 */

export interface SummaryInput {
  site: { logo: string; cover: string; tagline: string; about: string; whatsapp: string; hours: string; onlineBooking: boolean }
  services: { price: number; visible: boolean }[]
}

export interface SummaryItem {
  id: 'foto' | 'textos' | 'servicos' | 'horario' | 'whatsapp'
  label: string
  detail: string
  ok: boolean
}

export interface PublishSummary {
  items: SummaryItem[]
  /** como a cliente fala com o salão: pede o horário pelo site ou só chama no WhatsApp */
  booking: 'online' | 'whatsapp' | 'none'
  /** avisos para quem acabou de publicar (vazio quando está tudo certo) */
  warnings: string[]
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function publishSummary({ site, services }: SummaryInput): PublishSummary {
  const shown = services.filter((s) => s.visible)
  const noPrice = shown.filter((s) => !(s.price > 0)).length
  const hasWhats = Boolean(site.whatsapp.trim())
  const items: SummaryItem[] = [
    {
      id: 'foto',
      label: 'Foto',
      detail: site.logo ? 'Foto de perfil' : site.cover ? 'Capa' : 'Sem foto nem capa',
      ok: Boolean(site.logo || site.cover),
    },
    {
      id: 'textos',
      label: 'Apresentação',
      detail: site.tagline.trim() || site.about.trim() ? 'Frase e texto da página' : 'Sem frase nem texto',
      ok: Boolean(site.tagline.trim() || site.about.trim()),
    },
    {
      id: 'servicos',
      label: 'Serviços',
      detail: shown.length === 0 ? 'Nenhum serviço aparecendo' : noPrice > 0 ? `${plural(shown.length, 'serviço', 'serviços')}, ${plural(noPrice, 'sem preço', 'sem preço')}` : `${plural(shown.length, 'serviço', 'serviços')} com preço`,
      ok: shown.length > 0 && noPrice === 0,
    },
    { id: 'horario', label: 'Horário', detail: site.hours.trim() || 'Sem horário definido', ok: Boolean(site.hours.trim()) },
    { id: 'whatsapp', label: 'WhatsApp', detail: hasWhats ? 'Botão para chamar no WhatsApp' : 'Sem WhatsApp', ok: hasWhats },
  ]

  const booking = site.onlineBooking ? 'online' : hasWhats ? 'whatsapp' : 'none'
  const warnings: string[] = []
  if (booking === 'none') warnings.push('A cliente não tem como falar com você: ponha o WhatsApp em Meu negócio ou ligue o agendamento online.')
  else if (booking === 'whatsapp') warnings.push('O agendamento online está desligado: a cliente só consegue chamar no WhatsApp.')
  if (shown.length === 0) warnings.push('Nenhum serviço aparece na página.')
  else if (noPrice > 0) warnings.push(`${plural(noPrice, 'serviço está', 'serviços estão')} sem preço.`)
  return { items, booking, warnings }
}

import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { bestDay, dailyRange } from './metrics'
import { formatBRL, formatTime } from '../../lib/format'
import type { DayStatement, MonthClosing, ReceiptModel, ReceiptStat, ReceiptSum } from './types'

interface Context {
  salonName: string
  /** "agora": quem chama informa, para o recibo ser previsível nos testes */
  now: Date
}

/** "seg 12": dia da semana abreviado e número do dia, no jeito do recibo */
const weekdayDay = (date: Date) => format(date, 'EEE dd', { locale: ptBR }).replace('.', '')

/** recibo do mês: o mesmo documento do fechamento, aberto ou fechado */
export function buildMonthReceipt(month: MonthClosing, closedAt: Date | null, { salonName, now }: Context): ReceiptModel {
  const best = bestDay(month)
  const sums: ReceiptSum[] = [
    { label: 'Faturamento bruto', value: month.gross },
    ...(month.commissionsTotal > 0 ? [{ label: '(-) Comissões', value: month.commissionsTotal }] : []),
    ...(!month.partial ? [{ label: '(-) Produtos', value: month.products }] : []),
    ...(month.expenses > 0 ? [{ label: '(-) Despesas', value: month.expenses }] : []),
    { label: '(-) Taxas de cartão', value: month.cardFees },
    { label: 'Lucro líquido', value: month.net, total: true },
  ]
  const stats: ReceiptStat[] = [
    { label: 'Atendimentos', value: month.appointments, kind: 'count' },
    { label: 'Ticket médio', value: month.ticket, kind: 'money' },
    { label: 'Novas clientes', value: month.newClients, kind: 'count' },
    { label: 'Retorno', value: month.returnRate, kind: 'percent' },
    { label: 'Faltas', value: month.noShows, kind: 'count' },
  ]
  return {
    kind: 'month',
    number: month.id.replace('-', ''),
    title: month.partial ? 'Recibo do período' : 'Recibo do mês',
    period: (month.partial ? (month.rangeLabel ?? '') : format(month.date, 'MMMM yyyy', { locale: ptBR })).toUpperCase(),
    salonName,
    closed: closedAt !== null && !month.partial,
    closedAt: month.partial ? null : closedAt,
    preview: month.partial ? true : closedAt === null,
    previewLabel: month.partial ? 'período parcial' : 'mês em aberto',
    itemsHeading: 'Item',
    lines: month.categories.map((c) => ({ label: c.name, qty: c.qty, total: c.total })),
    sums,
    stats,
    chart: {
      title: 'Faturamento diário',
      values: month.daily,
      range: dailyRange(month),
      best: best ? { label: weekdayDay(addDays(month.date, best.day - 1)), value: best.value } : null,
    },
    note: month.partial ? 'Produtos e custos fixos entram no fechamento do mês.' : null,
    footer: month.partial ? 'Período parcial, sem fechamento' : closedAt ? `Fechado em ${format(closedAt, "dd/MM/yyyy 'às' HH:mm")}` : `Valores parciais até ${format(now, 'dd/MM')}`,
  }
}

/** recibo do dia: o que entrou, por forma de pagamento, e o que sobra depois de comissões, taxas e saídas */
export function buildDayReceipt(day: DayStatement, { salonName, now }: Context): ReceiptModel {
  const date = new Date(`${day.date}T12:00:00`)
  const isToday = day.date === format(now, 'yyyy-MM-dd')
  const sums: ReceiptSum[] = [
    { label: 'Recebido', value: day.gross },
    ...(day.commissionsTotal > 0 ? [{ label: '(-) Comissões', value: day.commissionsTotal }] : []),
    { label: '(-) Taxas de cartão', value: day.cardFees },
    ...(day.expensesTotal > 0 ? [{ label: '(-) Saídas', value: day.expensesTotal }] : []),
    { label: 'Resultado do dia', value: day.net, total: true },
  ]
  const stats: ReceiptStat[] = [
    { label: 'Atendimentos', value: day.count, kind: 'count' },
    { label: 'Ticket médio', value: day.count ? Math.round(day.gross / day.count) : 0, kind: 'money' },
    { label: 'Faltas', value: day.noShows, kind: 'count' },
    ...day.byMethod.map((m) => ({ label: m.label, value: m.total, kind: 'money' as const })),
  ]
  return {
    kind: 'day',
    number: day.date.replace(/-/g, ''),
    title: 'Recibo do dia',
    period: format(date, "EEEE, d 'de' MMMM yyyy", { locale: ptBR }).toUpperCase(),
    salonName,
    closed: false,
    closedAt: null,
    preview: isToday,
    previewLabel: 'dia em andamento',
    itemsHeading: 'Atendimento',
    lines: day.items.map((i) => ({ label: `${formatTime(i.time)} ${i.clientName} · ${i.serviceName}`, total: i.price })),
    sums,
    stats,
    chart: null,
    note: 'Produtos e custos fixos entram no fechamento do mês.',
    footer: isToday ? `Valores parciais até ${format(now, 'HH:mm')}` : 'Dia encerrado',
  }
}

/** resumo do recibo em texto, para mandar no WhatsApp */
export function receiptSummaryText(model: ReceiptModel): string {
  return [
    `${model.title} - ${model.salonName}`,
    model.period,
    ...model.sums.map((s) => `${s.label}: ${formatBRL(s.value)}`),
    ...model.stats.filter((s) => s.kind === 'count').map((s) => `${s.label}: ${s.value}`),
  ].join('\n')
}

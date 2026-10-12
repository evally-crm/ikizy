import { WAFFLE_DOTS } from './rates'
import { formatBRL } from '../../lib/format'
import type { CompositionPart, MonthClosing, PaymentLine, WeekTotal } from './types'

/** percentual inteiro de uma parte sobre o total (0 quando o total é zero) */
export const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)

/** crescimento do faturamento sobre o mês anterior, em %; null quando não há base de comparação */
export function growthPct(month: MonthClosing, previous: MonthClosing | undefined): number | null {
  if (!previous || !previous.gross) return null
  return Math.round(((month.gross - previous.gross) / previous.gross) * 100)
}

/** margem de lucro: quanto do faturamento sobra (0 se o mês deu prejuízo) */
export const marginPct = (month: MonthClosing) => pct(Math.max(month.net, 0), month.gross)

/** tudo que saiu do faturamento */
export const outflowOf = (month: MonthClosing) => month.commissionsTotal + month.products + month.expenses + month.cardFees

/** para onde foi o dinheiro: lucro e cada tipo de saída (só as que existem; o lucro sempre aparece) */
export function composition(month: MonthClosing): CompositionPart[] {
  const parts: Omit<CompositionPart, 'share'>[] = [
    { tone: 'net', label: 'Lucro', value: Math.max(month.net, 0) },
    { tone: 'commissions', label: 'Comissões', value: month.commissionsTotal },
    { tone: 'products', label: 'Produtos', value: month.products },
    { tone: 'expenses', label: 'Despesas', value: month.expenses },
    { tone: 'fees', label: 'Taxas', value: month.cardFees },
  ]
  return parts.filter((p) => p.value > 0 || p.tone === 'net').map((p) => ({ ...p, share: pct(p.value, month.gross) }))
}

/** o card de comissões só faz sentido com equipe (ou se já houve comissão) */
export const showsTeam = (month: MonthClosing, professionalsCount: number) => professionalsCount > 1 || month.commissionsTotal > 0

/** faturamento agrupado por semana do mês (1–7, 8–14, 15–21, 22–28, 29–fim) */
export function weeksOf(month: MonthClosing): WeekTotal[] {
  const weeks: WeekTotal[] = []
  const today = month.isCurrent ? month.elapsedDays - 1 : -1
  for (let start = 0; start < month.daily.length; start += 7) {
    const days = month.daily.slice(start, start + 7)
    weeks.push({
      label: `Sem ${weeks.length + 1}`,
      total: days.reduce<number>((t, v) => t + (v ?? 0), 0),
      future: days.every((v) => v === null),
      current: today >= start && today < start + 7,
    })
  }
  return weeks
}

/** posição da melhor semana (-1 se nenhuma teve faturamento) */
export function bestWeekIndex(weeks: WeekTotal[]): number {
  const best = weeks.reduce((b, w, i) => (w.total > weeks[b].total ? i : b), 0)
  return weeks[best]?.total ? best : -1
}

/** média por semana já iniciada; 0 quando o mês ainda não faturou */
export function weeklyAverage(month: MonthClosing): number {
  const started = weeksOf(month).filter((w) => !w.future).length
  return month.gross > 0 && started > 0 ? Math.round(month.gross / started) : 0
}

/** melhor dia do mês (dia 1–31 e valor), ou null se nenhum dia faturou */
export function bestDay(month: MonthClosing): { day: number; value: number } | null {
  let best: { day: number; value: number } | null = null
  month.daily.forEach((value, i) => {
    if (value !== null && value > 0 && (!best || value > best.value)) best = { day: i + 1, value }
  })
  return best
}

/** menor e maior faturamento entre os dias que faturaram */
export function dailyRange(month: MonthClosing): [number, number] {
  const open = month.daily.filter((v): v is number => v !== null && v > 0)
  return open.length ? [Math.min(...open), Math.max(...open)] : [0, 0]
}

export interface PaymentShare extends PaymentLine {
  /** percentual inteiro do total recebido */
  share: number
  /** tamanho da barra: 0–1, relativo à maior forma */
  relative: number
  top: boolean
}

/** formas de pagamento com a parte de cada uma e o tamanho relativo da barra */
export function paymentShares(payments: PaymentLine[]): PaymentShare[] {
  const total = payments.reduce((sum, p) => sum + p.total, 0)
  const max = Math.max(...payments.map((p) => p.total), 1)
  return payments.map((p) => ({ ...p, share: pct(p.total, total), relative: p.total / max, top: p.total === max }))
}

/**
 * reparte os pontos da grade entre as partes pelo método do maior resto:
 * cada parte ganha o inteiro da sua fatia e os pontos que sobram vão para os maiores restos.
 */
export function waffleCounts(values: number[], total: number, dots = WAFFLE_DOTS): number[] {
  if (!total) return values.map(() => 0)
  const raw = values.map((v) => (v / total) * dots)
  const counts = raw.map(Math.floor)
  let left = dots - counts.reduce((a, b) => a + b, 0)
  raw
    .map((v, i) => ({ i, rest: v - Math.floor(v) }))
    .sort((a, b) => b.rest - a.rest)
    .forEach(({ i }) => {
      if (left > 0 && raw[i] > 0) {
        counts[i]++
        left--
      }
    })
  return counts
}

/** resumo curto do fechamento para mandar no WhatsApp */
export function monthSummaryText(month: MonthClosing, salonName: string): string {
  return [
    `Fechamento de ${month.label} - ${salonName}`,
    `Faturamento: ${formatBRL(month.gross)}`,
    `Lucro líquido: ${formatBRL(month.net)}`,
    `Atendimentos: ${month.appointments}`,
  ].join('\n')
}

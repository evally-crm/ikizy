import { endOfMonth, format } from 'date-fns'

export interface ExpenseDraft {
  description: string
  /** como foi digitado: "1.250,50" */
  amount: string
  /** yyyy-MM-dd */
  date: string
}

export type ExpenseCheck = { ok: true; value: { date: string; description: string; amount: number } } | { ok: false; error: string }

/** "1.250,50" → 1250.5; NaN quando não é um número */
export const parseAmount = (text: string) => Number(text.replace(/\./g, '').replace(',', '.'))

/** confere a saída digitada: descrição, valor maior que zero e data dentro do mês exibido */
export function checkExpense(draft: ExpenseDraft, monthId: string, monthLabel: string): ExpenseCheck {
  const description = draft.description.trim()
  const amount = parseAmount(draft.amount)
  if (!description) return { ok: false, error: 'Descreva a saída.' }
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Informe um valor maior que zero.' }
  if (!draft.date.startsWith(monthId)) return { ok: false, error: `A data precisa estar em ${monthLabel}.` }
  return { ok: true, value: { date: draft.date, description, amount } }
}

/** data inicial da nova saída: hoje no mês em andamento, o último dia nos meses que já acabaram */
export function defaultExpenseDate(monthDate: Date, isCurrent: boolean, now: Date): string {
  return format(isCurrent ? now : endOfMonth(monthDate), 'yyyy-MM-dd')
}

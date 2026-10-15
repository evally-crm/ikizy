import { placeBlock } from '../business/hours'
import { DAY_CHIPS } from './hours'

/** um atendimento de exemplo na prévia da agenda (só desenho; nada disso é gravado) */
export interface PreviewBlock {
  name: string
  /** posição na coluna do dia, em % */
  top: number
  height: number
}

export interface PreviewDay {
  weekday: number
  label: string
  open: boolean
  /** faixa aberta do dia na grade, em % */
  openTop: number
  openHeight: number
  blocks: PreviewBlock[]
}

export interface PreviewWeek {
  days: PreviewDay[]
  /** horas cheias marcadas na lateral da grade ("09:00") */
  hours: number[]
}

/** grade padrão quando ainda não há horário: 8h às 20h */
const FALLBACK = { from: 8 * 60, to: 20 * 60 }

/** onde começa cada atendimento de exemplo, em minutos depois da abertura, e quantos o dia tem */
const SLOTS = [30, 180, 330]

/**
 * semana de exemplo para o fundo do cadastro: os dias que a pessoa marcou ficam abertos e,
 * com `filled`, ganham atendimentos de exemplo com os serviços dela (um padrão fixo, sem sorteio).
 */
export function previewWeek(
  days: number[],
  start: number,
  end: number,
  services: { name: string; duration: number }[],
  filled: boolean,
): PreviewWeek {
  const valid = days.length > 0 && end > start
  const span = valid ? { from: Math.floor(start / 60) * 60 - 60, to: Math.ceil(end / 60) * 60 + 60 } : FALLBACK
  const hours: number[] = []
  for (let m = span.from; m < span.to; m += 120) hours.push(m)
  let n = 0
  return {
    hours,
    days: DAY_CHIPS.map((d, i) => {
      const open = valid && days.includes(d.weekday)
      const range = open ? placeBlock({ weekday: d.weekday, start, end }, span) : { top: 0, height: 0 }
      const blocks: PreviewBlock[] = []
      if (open && filled && services.length > 0) {
        // dias alternados com 2 e 3 atendimentos, para a semana não parecer carimbada
        const count = i % 2 === 0 ? 3 : 2
        for (const offset of SLOTS.slice(0, count)) {
          const s = services[n++ % services.length]
          const from = start + offset + (i % 3) * 30
          const to = Math.min(from + Math.min(s.duration, 120), end)
          if (to - from < 20) continue
          const place = placeBlock({ weekday: d.weekday, start: from, end: to }, span)
          blocks.push({ name: s.name, top: place.top, height: place.height })
        }
      }
      return { weekday: d.weekday, label: d.label.slice(0, 3), open, openTop: range.top, openHeight: range.height, blocks }
    }),
  }
}

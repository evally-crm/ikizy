import { useState, type KeyboardEvent } from 'react'
import { Sparkles, X } from 'lucide-react'
import { OTHER_SEGMENT, SEGMENTS } from '../../lib/segments'
import { Ask, Suggestion, Suggestions } from './Ask'

const ALL = [...SEGMENTS, OTHER_SEGMENT]
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

/**
 * "O que você faz?": as áreas escolhidas viram chips dentro do campo e as sugestões ficam embaixo.
 * Digitar o nome de uma área marca ela; qualquer outra coisa vira "Outro" com aquele nome.
 */
export function StepAreas({
  segments,
  otherLabel,
  onChange,
}: {
  segments: string[]
  otherLabel: string
  onChange: (segments: string[], otherLabel: string) => void
}) {
  const [text, setText] = useState('')
  const toggle = (id: string) =>
    onChange(segments.includes(id) ? segments.filter((s) => s !== id) : [...segments, id], id === OTHER_SEGMENT.id && segments.includes(id) ? '' : otherLabel)
  const labelOf = (id: string) => (id === OTHER_SEGMENT.id ? otherLabel.trim() || 'Outro' : ALL.find((s) => s.id === id)?.label ?? id)
  const waitingOther = segments.includes(OTHER_SEGMENT.id) && otherLabel.trim().length < 2

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !text && segments.length > 0) {
      const last = segments[segments.length - 1]
      onChange(segments.slice(0, -1), last === OTHER_SEGMENT.id ? '' : otherLabel)
      return
    }
    if (e.key !== 'Enter' || !text.trim()) return
    // com texto, Enter marca a área em vez de seguir para a próxima pergunta
    e.preventDefault()
    const known = SEGMENTS.find((s) => fold(s.label) === fold(text))
    if (known) onChange(segments.includes(known.id) ? segments : [...segments, known.id], otherLabel)
    else onChange(segments.includes(OTHER_SEGMENT.id) ? segments : [...segments, OTHER_SEGMENT.id], text.trim().slice(0, 40))
    setText('')
  }

  return (
    <>
      <Ask icon={<Sparkles size={20} />} goLabel="Continuar">
        {segments.map((id) => (
          <span key={id} className="ask-chip">
            {labelOf(id)}
            <button type="button" className="ask-chip__x" aria-label={`Tirar ${labelOf(id)}`} onClick={() => toggle(id)}>
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          className="ask__input"
          aria-label={waitingOther ? 'Qual é a outra área?' : 'Digite uma área'}
          placeholder={waitingOther ? 'Qual? Ex.: Maquiagem' : segments.length ? 'Mais alguma?' : 'Escolha abaixo ou digite'}
          autoFocus
          maxLength={40}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
        />
      </Ask>
      <Suggestions label="Áreas">
        {ALL.map((s) => (
          <Suggestion key={s.id} on={segments.includes(s.id)} onClick={() => toggle(s.id)}>
            {s.label}
          </Suggestion>
        ))}
      </Suggestions>
    </>
  )
}

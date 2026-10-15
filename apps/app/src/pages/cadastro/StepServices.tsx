import { useState, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import type { ReviewGroup, ServiceChange } from '../../domain/onboarding'
import { Next } from './Ask'
import './StepServices.css'

/** "Revise seus serviços": por área, os serviços em etiquetas que saem no X, e "Adicionar" para pôr outro */
export function StepServices({
  groups,
  onRemove,
  onAdd,
}: {
  groups: ReviewGroup[]
  onRemove: (change: ServiceChange) => void
  /** devolve o erro para mostrar, ou null se entrou */
  onAdd: (change: ServiceChange) => string | null
}) {
  return (
    <>
      <div className="onb-svc">
        {groups.map((g) => (
          <ServiceRow key={g.segment} group={g} onRemove={onRemove} onAdd={onAdd} />
        ))}
      </div>
      <Next label="Está bom" sticky />
    </>
  )
}

function ServiceRow({
  group,
  onRemove,
  onAdd,
}: {
  group: ReviewGroup
  onRemove: (change: ServiceChange) => void
  onAdd: (change: ServiceChange) => string | null
}) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const problem = onAdd({ segment: group.segment, name: text })
    setError(problem)
    if (!problem) setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setAdding(false)
      setError(null)
    }
    if (e.key !== 'Enter') return
    // Enter aqui põe o serviço, não segue para a próxima tela
    e.preventDefault()
    if (text.trim()) add()
    else setAdding(false)
  }

  return (
    <div className="onb-svc__row">
      <span className="onb-svc__label">{group.label}</span>
      <div className="onb-svc__tags">
        {group.services.map((s) => (
          <span key={s.name} className="onb-svc__tag">
            {s.name}
            <button
              type="button"
              className="onb-svc__x"
              aria-label={`Tirar ${s.name}`}
              onClick={() => onRemove({ segment: group.segment, name: s.name })}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ))}
        {adding ? (
          <span className="onb-svc__new">
            <input
              aria-label={`Novo serviço de ${group.label}`}
              placeholder="Nome do serviço"
              autoFocus
              maxLength={80}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
            />
            <button type="button" className="onb-svc__ok" onClick={add} disabled={!text.trim()}>
              Incluir
            </button>
          </span>
        ) : (
          <button type="button" className="onb-svc__add" onClick={() => setAdding(true)}>
            Adicionar <Plus size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {error && (
        <p className="onb-svc__err" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

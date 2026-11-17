import { ArrowLeft, ArrowRight, Check, Rocket } from 'lucide-react'
import type { GuideStep } from '../../domain/site'
import { Button } from '../../components/ui'

interface Props {
  steps: GuideStep[]
  index: number
  publishing: boolean
  onGo: (index: number) => void
  onPublish: () => void
  onSkip: () => void
}

/** assistente da primeira vez: um passo por vez, levando à parte certa do editor */
export function SetupGuide({ steps, index, publishing, onGo, onPublish, onSkip }: Props) {
  const step = steps[index]
  const last = index === steps.length - 1
  return (
    <section className="guide" aria-label="Passo a passo para publicar">
      <div className="guide__top">
      <ol className="guide__dots" aria-label={`Passo ${index + 1} de ${steps.length}`}>
        {steps.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={`guide__dot ${i === index ? 'is-now' : ''} ${s.done ? 'is-done' : ''}`.trim()}
              aria-label={`${s.title}${s.done ? ', pronto' : ''}`}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => onGo(i)}
            >
              {s.done ? <Check size={12} aria-hidden="true" /> : i + 1}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="guide__skip" onClick={onSkip}>
        Fechar guia
      </button>
      </div>
      <div className="guide__text">
        <p className="guide__title">
          <span>
            Passo {index + 1} de {steps.length}
          </span>
          {step.title}
        </p>
        <p className="guide__hint">{step.hint}</p>
      </div>
      <div className="guide__actions">
        {index > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onGo(index - 1)}>
            <ArrowLeft size={15} aria-hidden="true" /> Voltar
          </Button>
        )}
        {last ? (
          <Button size="sm" className="guide__go" disabled={publishing} onClick={onPublish}>
            <Rocket size={15} aria-hidden="true" /> Publicar site
          </Button>
        ) : (
          <Button size="sm" className="guide__go" onClick={() => onGo(index + 1)}>
            {step.done ? 'Continuar' : 'Pular por agora'} <ArrowRight size={15} aria-hidden="true" />
          </Button>
        )}
      </div>
    </section>
  )
}

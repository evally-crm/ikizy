import { Rocket } from 'lucide-react'
import { hasPendingPublish, publishButton, type PublishState } from '../../domain/site'
import { Button } from '../../components/ui'

/** botão de publicar: texto e estado vêm do domínio (`header` no topo do computador, `compact` na barra do celular) */
export function PublishButton({ state, variant, onClick }: { state: PublishState; variant: 'header' | 'compact'; onClick: () => void }) {
  const { label, disabled } = publishButton(state, variant)
  const pending = hasPendingPublish(state)
  return (
    <Button size="sm" className={`publishbtn ${pending ? 'publishbtn--pending' : ''}`.trim()} disabled={disabled} onClick={onClick}>
      <Rocket size={15} aria-hidden="true" />
      {label}
      {pending && <span className="publishbtn__dot" aria-label="Há alterações não publicadas" />}
    </Button>
  )
}

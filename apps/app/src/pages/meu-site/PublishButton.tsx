import { Rocket } from 'lucide-react'
import { publishButton, type PublishState } from '../../domain/site'
import { Button } from '../../components/ui'

/** botão de publicar: texto e estado vêm do domínio (`header` no topo, `bar` na barra do celular) */
export function PublishButton({ state, variant, onClick }: { state: PublishState; variant: 'header' | 'bar'; onClick: () => void }) {
  const { label, disabled } = publishButton(state, variant)
  return (
    <Button size="sm" disabled={disabled} onClick={onClick}>
      <Rocket size={15} aria-hidden="true" />
      {label}
    </Button>
  )
}

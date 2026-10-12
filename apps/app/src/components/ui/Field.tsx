import { useId, type ReactNode } from 'react'

/** campo de formulário: rótulo ligado ao controle (recebe o `id`) e uma dica opcional embaixo */
export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      {children(id)}
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  )
}

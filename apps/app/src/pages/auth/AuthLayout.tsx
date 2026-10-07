import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Button, Card } from '../../components/ui'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <div className="shell__orb" aria-hidden="true" />
      <div className="auth__box">
        <p className="logo auth__logo">
          IKIZY<span className="logo__dot">.</span>
        </p>
        {children}
      </div>
    </div>
  )
}

/** cartão padrão das telas de acesso */
export function AuthCard({ title, subtitle, children }: { title: ReactNode; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="auth__card">
      <h1 className="auth__title">{title}</h1>
      {subtitle && <p className="card__sub">{subtitle}</p>}
      {children}
    </Card>
  )
}

export function AuthField({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <span className="input">
        <input id={id} {...input} />
      </span>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  )
}

export function FormMessages({ error, notice }: { error: string | null; notice?: string | null }) {
  return (
    <>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert alert--ok" role="status">
          {notice}
        </p>
      )}
    </>
  )
}

/** botão "continuar com Google" + divisor "ou"; devolve o erro ao formulário pai */
export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <>
      <Button variant="light" onClick={onClick} disabled={disabled}>
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
          <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.300-8.3 2.300-6.300 0-11.6-4.100-13.5-9.8l-7.9 6.1C6.5 42.6 14.600 48 24 48z" />
        </svg>
        Continuar com Google
      </Button>
      <p className="auth__or" aria-hidden="true">
        <span>ou</span>
      </p>
    </>
  )
}

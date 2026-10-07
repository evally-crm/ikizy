import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Card } from '../../components/ui'

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

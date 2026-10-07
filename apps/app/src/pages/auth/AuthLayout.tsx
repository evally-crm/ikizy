import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Card } from '../../components/ui'
import { HalftoneArt } from './HalftoneArt'

/** `topAction` fica à direita da marca (ex.: link "Criar conta") */
export function AuthLayout({ children, topAction }: { children: ReactNode; topAction?: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth__bg" aria-hidden="true">
        <span />
        <span />
      </div>
      <HalftoneArt />
      <div className="auth__box">
        <header className="auth__top">
          <p className="logo auth__logo">
            IKIZY<span className="logo__dot">.</span>
          </p>
          {topAction && <div className="auth__top-action">{topAction}</div>}
        </header>
        {children}
      </div>
    </div>
  )
}

/** bloco das telas de acesso, sem caixa: os elementos ficam soltos sobre o fundo; `aside` fica à direita do título */
export function AuthCard({
  title,
  subtitle,
  aside,
  children,
}: {
  title: ReactNode
  subtitle?: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="auth__card">
      <div className="auth__head">
        <h1 className="auth__title">{title}</h1>
        {aside}
      </div>
      {subtitle && <p className="card__sub">{subtitle}</p>}
      {children}
    </Card>
  )
}

/** campo em pílula: o rótulo fica só para leitores de tela e vira o placeholder */
export function AuthField({
  label,
  hint,
  icon,
  action,
  ...input
}: { label: string; hint?: string; icon?: ReactNode; action?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <span className="input">
        {icon && (
          <span className="auth__ico" aria-hidden="true">
            {icon}
          </span>
        )}
        <input id={id} placeholder={label} {...input} />
        {action}
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

/** rodapé do formulário: aviso legal à esquerda e o disco escuro com seta (envia o formulário) à direita */
export function AuthSubmit({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <div className="auth__foot">
      <p className="auth__legal">
        Ao continuar, você concorda com os{' '}
        <a href="https://ikizy.com/termos" target="_blank" rel="noreferrer">
          Termos de uso
        </a>{' '}
        e a{' '}
        <a href="https://ikizy.com/privacidade" target="_blank" rel="noreferrer">
          Política de privacidade
        </a>
        .
      </p>
      <button type="submit" className="auth__go" disabled={disabled} aria-label={label} title={label}>
        <ArrowRight size={22} aria-hidden="true" />
      </button>
    </div>
  )
}

/** pílula pequena "Google" ao lado do título, no estilo dos logins sociais compactos */
export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="auth__social" onClick={onClick} disabled={disabled} aria-label="Continuar com Google">
      <span className="auth__social-ico" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
          <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
      </span>
      Google
    </button>
  )
}

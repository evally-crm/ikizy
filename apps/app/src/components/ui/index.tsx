import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { AppointmentStatus } from '../../types'
import { formatBRL } from '../../lib/format'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'light' | 'ghost' | 'soft' | 'accent'
  size?: 'md' | 'sm'
  icon?: boolean
}

export function Button({ variant = 'primary', size = 'md', icon, className = '', ...rest }: ButtonProps) {
  const cls = ['btn', `btn--${variant}`, size === 'sm' && 'btn--sm', icon && 'btn--icon', className]
    .filter(Boolean)
    .join(' ')
  return <button type="button" className={cls} {...rest} />
}

/** valor em reais com "R$" e centavos pequenos, no estilo de número grande das referências */
export function Money({ value, size = 'lg' }: { value: number; size?: 'md' | 'lg' | 'xl' }) {
  const [int, dec] = formatBRL(value).replace(/[^\d.,]/g, '').split(',')
  return (
    <span className={`money money--${size}`}>
      <span className="money__cur">R$</span>
      {int}
      <span className="money__dec">,{dec}</span>
    </span>
  )
}

/** anel de progresso (0–100) */
export function Ring({ value, size = 76, label }: { value: number; size?: number; label: string }) {
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(Math.max(value, 0), 100)
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${pct}%`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-200)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand-500)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring__value">
        {Math.round(pct)}
        <small>%</small>
      </span>
    </div>
  )
}

export function Card({
  variant,
  className = '',
  children,
}: {
  variant?: 'soft' | 'brand' | 'dark'
  className?: string
  children: ReactNode
}) {
  return <section className={`card ${variant ? `card--${variant}` : ''} ${className}`}>{children}</section>
}

/** palavra de destaque (serifada, itálica, cor de acento) */
export function Em({ children }: { children: ReactNode }) {
  return <span className="em">{children}</span>
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  confirmado: 'Confirmado',
  pendente: 'Aguardando',
  atendimento: 'Em atendimento',
  concluido: 'Concluído',
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>
}

export function Avatar({ name, size, soft }: { name: string; size?: 'sm'; soft?: boolean }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
  return (
    <span className={`avatar ${size ? `avatar--${size}` : ''} ${soft ? 'avatar--soft' : ''}`} aria-hidden="true">
      {initials}
    </span>
  )
}

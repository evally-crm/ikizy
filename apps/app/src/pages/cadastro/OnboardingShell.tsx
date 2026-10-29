import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import './OnboardingShell.css'
import { LogoWord } from '../../components/BunnyMark'

/**
 * Moldura do cadastro: tela cheia e limpa. Logo e "Voltar" à esquerda, a conta e "Sair" à direita,
 * a prévia do sistema (`backdrop`) ao fundo e uma pergunta por vez no meio.
 */
export function OnboardingShell({
  backdrop,
  onBack,
  size,
  children,
}: {
  backdrop: ReactNode
  /** sem `onBack`, o "Voltar" some (primeira pergunta) */
  onBack?: () => void
  /** largura do miolo: `md` para campos com várias peças (horário, serviços), `wide` para os planos */
  size?: 'md' | 'wide'
  children: ReactNode
}) {
  const { status, session, signOut } = useAuth()
  const email = session?.user.email
  return (
    <div className="onb">
      <div className="onb__backdrop" aria-hidden="true">
        {backdrop}
      </div>

      <header className="onb__top">
        <div className="onb__left">
          <p className="logo onb__logo">
            <LogoWord />
          </p>
          {onBack && (
            <button type="button" className="onb__back" onClick={onBack}>
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar
            </button>
          )}
        </div>
        <div className="onb__account">
          {status === 'demo' ? (
            <span className="onb__who">Modo demonstração: nada é gravado</span>
          ) : (
            email && (
              <span className="onb__who">
                Entrou como <b>{email}</b>
              </span>
            )
          )}
          <button type="button" className="onb__out" onClick={() => void signOut()}>
            Sair
          </button>
        </div>
      </header>

      <main className={size ? `onb__stage onb__stage--${size}` : 'onb__stage'}>{children}</main>

      <footer className="onb__foot">
        <a href="https://ikizy.com/privacidade" target="_blank" rel="noreferrer">
          Privacidade
        </a>
        <a href="https://ikizy.com/termos" target="_blank" rel="noreferrer">
          Termos
        </a>
      </footer>
    </div>
  )
}

/** título grande, subtítulo curto e os tracinhos de progresso; `key` no pai anima a troca de pergunta */
export function Question({
  title,
  subtitle,
  progress,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** [atual, total], começando em 1 */
  progress?: [number, number]
  children: ReactNode
}) {
  return (
    <section className="onb__q">
      {progress && (
        <div className="onb__dashes" role="img" aria-label={`Pergunta ${progress[0]} de ${progress[1]}`}>
          {Array.from({ length: progress[1] }, (_, i) => (
            <span key={i} className={i < progress[0] ? 'onb__dash onb__dash--on' : 'onb__dash'} />
          ))}
        </div>
      )}
      <h1 className="onb__title">{title}</h1>
      {subtitle && <p className="onb__sub">{subtitle}</p>}
      {children}
    </section>
  )
}

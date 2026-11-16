import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Download, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useSubscription } from '../../billing/SubscriptionProvider'
import { Button } from '../../components/ui'
import { downloadMyData, fetchSummary, type AccountSummary } from '../../lib/accountApi'
import { BillingError } from '../../lib/billingApi'
import { dash } from '../../lib/routes'
import './Excluir.css'

/** motivos (opcionais) que a dona pode marcar; os códigos são os mesmos que o servidor aceita (REASONS em api/_lib/account.ts) */
const REASONS = [
  { id: 'nao-uso', label: 'Não estou usando' },
  { id: 'caro', label: 'Achei caro' },
  { id: 'faltam-recursos', label: 'Faltam recursos que eu preciso' },
  { id: 'dificil', label: 'É difícil de usar' },
  { id: 'outro-sistema', label: 'Vou usar outro sistema' },
  { id: 'fechei', label: 'Fechei o meu negócio' },
  { id: 'outro', label: 'Outro motivo' },
] as const

type Step = 'sure' | 'why' | 'confirm'

const long = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`
const GRACE_DAYS = 7
const GOODBYE_KEY = 'ikizy:goodbye'

/**
 * /dashboard/conta/excluir: o caminho para sair, em etapas e sem pressa. Primeiro diz o que se perde (com os números do negócio)
 * e o que dá para fazer antes (levar os dados, só cancelar a assinatura); depois pergunta o motivo (opcional); por fim pede a
 * confirmação digitada. A dona tem 7 dias para desistir; quem é da equipe sai na hora.
 */
export default function ExcluirConta() {
  const { salon, session, status, deleteAccount, cancelDeletion, deletionAt } = useAuth()
  const { sub } = useSubscription()
  const navigate = useNavigate()
  const isOwner = !salon || salon.role === 'owner'

  const [step, setStep] = useState<Step>('sure')
  const [summary, setSummary] = useState<AccountSummary | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [justScheduled, setJustScheduled] = useState(false)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    if (status !== 'ready') return
    let alive = true
    void fetchSummary().then((s) => alive && setSummary(s))
    return () => {
      alive = false
    }
  }, [status])

  // sem login real não há conta para excluir (modo demonstração)
  if (status === 'demo' || (status !== 'loading' && !session)) return <Navigate to={dash('/conta')} replace />

  const salonName = salon?.name ?? summary?.salonName ?? ''
  const expected = isOwner ? salonName : 'excluir'
  const ok = typed.trim().toLowerCase() === expected.trim().toLowerCase() && expected.length > 0
  const scheduleDate = new Date(now + GRACE_DAYS * 24 * 60 * 60 * 1000)
  // Pix já pago e ainda dentro do período: o valor não volta
  const prepaidUntil = isOwner && sub?.method === 'pix' && sub.status === 'active' && sub.accessUntil.getTime() > now ? sub.accessUntil : null
  const hasCard = isOwner && sub?.method === 'card' && sub.status !== 'canceled'
  const steps = isOwner ? 3 : 2
  const position = step === 'sure' ? 1 : step === 'why' ? 2 : steps

  const takeData = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await downloadMyData()
      setExported(true)
    } catch (e) {
      setExportError(e instanceof BillingError ? e.message : 'Não foi possível baixar agora. Tente novamente.')
    }
    setExporting(false)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    setError(null)
    // quem é da equipe sai na hora e volta para o login: deixa o recado pronto antes de a sessão acabar
    if (!isOwner) {
      try {
        sessionStorage.setItem(GOODBYE_KEY, '1')
      } catch {
        // sem armazenamento: só não mostra o recado
      }
    }
    const message = await deleteAccount(typed, isOwner && reason ? { reason, comment } : undefined)
    setBusy(false)
    if (message) {
      try {
        sessionStorage.removeItem(GOODBYE_KEY)
      } catch {
        // idem
      }
      setError(message)
      return
    }
    if (isOwner) setJustScheduled(true)
  }

  // ---------------------------------------------------------------- exclusão já agendada (acabou de pedir, ou voltou à página)
  if (isOwner && deletionAt) {
    return (
      <div className="page excluir">
        <div className="excluir__done">
          <span className="excluir__badge" aria-hidden="true">
            <Check size={26} strokeWidth={2.4} />
          </span>
          <h1 className="excluir__title">{justScheduled ? 'Pedido recebido' : 'Exclusão agendada'}</h1>
          <p className="excluir__lead">
            Sua conta e o negócio <strong>{salonName}</strong> serão apagados em <strong>{long(deletionAt)}</strong>.
            {justScheduled && ' Enviamos um e-mail com essa data.'} Até lá nada muda, e você pode desistir quando quiser.
          </p>
          {error && (
            <p className="dialog__error" role="alert">
              {error}
            </p>
          )}
          <div className="excluir__actions">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const message = await cancelDeletion()
                setBusy(false)
                if (message) setError(message)
                else navigate(dash('/conta'), { replace: true })
              }}
            >
              {busy ? 'Cancelando…' : 'Cancelar exclusão e manter minha conta'}
            </Button>
            <Link to={dash()} className="excluir__link">
              Voltar ao IKIZY
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page excluir">
      <header className="excluir__head">
        <Link to={dash('/conta')} className="excluir__back">
          <ArrowLeft size={16} aria-hidden="true" /> Minha conta
        </Link>
        <div className="excluir__steps" role="progressbar" aria-valuemin={1} aria-valuemax={steps} aria-valuenow={position} aria-label={`Passo ${position} de ${steps}`}>
          {Array.from({ length: steps }, (_, i) => (
            <span key={i} className={i < position ? 'is-on' : ''} />
          ))}
        </div>
        <p className="excluir__count">
          Passo {position} de {steps}
        </p>
      </header>

      {/* ------------------------------------------------ 1. você tem certeza? */}
      {step === 'sure' && (
        <>
          <h1 className="excluir__title">Você tem certeza que quer excluir sua conta?</h1>
          <p className="excluir__lead">
            {isOwner
              ? `Leia com calma. Depois de confirmar, você ainda tem ${GRACE_DAYS} dias para desistir.`
              : 'Leia com calma. Isso não pode ser desfeito.'}
          </p>

          <section className="excluir__card">
            <h2 className="excluir__h2">{isOwner ? `O que acontece em ${long(scheduleDate)}` : 'O que acontece agora'}</h2>
            {isOwner ? (
              <ul className="excluir__list">
                <li>
                  <strong>{salonName || 'Seu negócio'}</strong> é apagado de vez
                  {summary ? (
                    <>
                      : {plural(summary.clients, 'cliente', 'clientes')}, {plural(summary.appointments, 'atendimento', 'atendimentos')}, o financeiro, as fotos e o site.
                    </>
                  ) : (
                    ': clientes, atendimentos, financeiro, fotos e site.'
                  )}
                </li>
                {summary && summary.members > 1 && <li>{plural(summary.members - 1, 'pessoa da equipe perde', 'pessoas da equipe perdem')} o acesso.</li>}
                {hasCard && <li>A renovação da assinatura no cartão é pausada já, então você não será cobrada de novo.</li>}
                {prepaidUntil && <li>Você pagou por Pix e tem acesso até {prepaidUntil.toLocaleDateString('pt-BR')}. Esse valor não é devolvido.</li>}
                <li>Depois da data, não existe como recuperar nada.</li>
              </ul>
            ) : (
              <ul className="excluir__list">
                <li>Seu login é apagado e você sai de {salonName || 'seu negócio'}.</li>
                <li>Os atendimentos continuam na agenda do negócio.</li>
                <li>Não existe como desfazer.</li>
              </ul>
            )}
          </section>

          {isOwner && (
            <section className="excluir__card">
              <h2 className="excluir__h2">Antes de decidir</h2>
              <div className="excluir__option">
                <div>
                  <strong>Leve uma cópia dos seus dados</strong>
                  <p>Planilhas de clientes, atendimentos, serviços e saídas, para abrir no Excel.</p>
                  {exportError && (
                    <p className="dialog__error" role="alert">
                      {exportError}
                    </p>
                  )}
                </div>
                <Button variant="light" size="sm" disabled={exporting} onClick={() => void takeData()}>
                  <Download size={15} aria-hidden="true" /> {exporting ? 'Preparando…' : exported ? 'Baixar de novo' : 'Baixar'}
                </Button>
              </div>
              {(hasCard || prepaidUntil) && (
                <div className="excluir__option">
                  <div>
                    <strong>Só quer parar de pagar?</strong>
                    <p>Cancele a assinatura e mantenha seus dados guardados, sem excluir a conta.</p>
                  </div>
                  <Link to={dash('/assinatura')} className="excluir__link">
                    Ver assinatura
                  </Link>
                </div>
              )}
            </section>
          )}

          <div className="excluir__actions">
            <Button onClick={() => navigate(dash('/conta'))}>Manter minha conta</Button>
            <button type="button" className="excluir__link excluir__link--muted" onClick={() => setStep(isOwner ? 'why' : 'confirm')}>
              Continuar com a exclusão
            </button>
          </div>
        </>
      )}

      {/* ------------------------------------------------ 2. por que? (só a dona, opcional) */}
      {step === 'why' && (
        <>
          <h1 className="excluir__title">Conta pra gente por que você está saindo?</h1>
          <p className="excluir__lead">É opcional, e ajuda a melhorar o IKIZY. Não aparece para ninguém além da nossa equipe.</p>

          <fieldset className="excluir__card excluir__reasons">
            <legend className="sr-only">Motivo</legend>
            {REASONS.map((r) => (
              <label key={r.id} className={`excluir__opt ${reason === r.id ? 'is-on' : ''}`.trim()}>
                <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
                <span className="excluir__dot" aria-hidden="true" />
                {r.label}
              </label>
            ))}
            {reason && (
              <label className="field excluir__comment">
                <span className="field__label">Quer contar mais? (opcional)</span>
                <span className="input">
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} rows={3} />
                </span>
              </label>
            )}
          </fieldset>

          <div className="excluir__actions">
            <Button onClick={() => setStep('confirm')}>Continuar</Button>
            <button
              type="button"
              className="excluir__link excluir__link--muted"
              onClick={() => {
                setReason(null)
                setComment('')
                setStep('confirm')
              }}
            >
              Pular
            </button>
            <button type="button" className="excluir__link excluir__link--muted" onClick={() => setStep('sure')}>
              Voltar
            </button>
          </div>
        </>
      )}

      {/* ------------------------------------------------ 3. confirmar */}
      {step === 'confirm' && (
        <form onSubmit={submit}>
          <h1 className="excluir__title">Última confirmação</h1>
          <p className="excluir__lead">
            {isOwner
              ? `Ao confirmar, ${salonName || 'o negócio'} fica agendado para ser apagado em ${long(scheduleDate)}. Até lá, você pode desistir.`
              : 'Ao confirmar, seu login é apagado agora.'}
          </p>

          <section className="excluir__card">
            <label className="field">
              <span className="field__label">
                Para confirmar, digite: <strong>{expected}</strong>
              </span>
              <span className="input">
                <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
              </span>
            </label>
            {error && (
              <p className="dialog__error" role="alert">
                {error}
              </p>
            )}
          </section>

          <div className="excluir__actions">
            <Button onClick={() => navigate(dash('/conta'))}>Manter minha conta</Button>
            <Button type="submit" variant="light" className="excluir__danger" disabled={!ok || busy}>
              <Trash2 size={16} aria-hidden="true" /> {busy ? 'Excluindo…' : isOwner ? 'Agendar a exclusão' : 'Excluir minha conta'}
            </Button>
            <button type="button" className="excluir__link excluir__link--muted" onClick={() => setStep(isOwner ? 'why' : 'sure')}>
              Voltar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

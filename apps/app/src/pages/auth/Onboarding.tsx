import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, User } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { noSalonPath, pendingInvite } from '../../lib/invite'
import { ROUTES } from '../../lib/routes'
import { isReservedSlug, SITE_DOMAIN, SLUG_PATTERN, siteHost, slugify } from '../../lib/slug'
import { PLAN_FOR_TEAM, SEGMENTS, TEAM_SIZES, type SalonSetup, type TeamSize } from '../../lib/segments'
import { Em } from '../../components/ui'
import { AuthField, AuthLayout, FormMessages } from './AuthLayout'

type StepId = 'segmentos' | 'equipe' | 'profissional' | 'servicos' | 'precos' | 'negocio'

const COPY: Record<StepId, { title: React.ReactNode; subtitle?: string }> = {
  segmentos: {
    title: (
      <>
        O que você <Em>oferece</Em>?
      </>
    ),
    subtitle: 'Pode marcar mais de um. Usamos isso para já deixar seus serviços prontos.',
  },
  equipe: {
    title: (
      <>
        Como é a sua <Em>equipe</Em>?
      </>
    ),
    subtitle: 'Seus 30 dias grátis começam no plano certo para o seu tamanho. Dá para trocar depois.',
  },
  profissional: {
    title: (
      <>
        Como você se <Em>chama</Em>?
      </>
    ),
    subtitle: 'Vamos cadastrar você como profissional na agenda.',
  },
  servicos: {
    title: (
      <>
        Quais <Em>serviços</Em> você faz?
      </>
    ),
    subtitle: 'Marcamos os mais comuns. Tire o que você não faz.',
  },
  precos: {
    title: (
      <>
        Quanto você <Em>cobra</Em>?
      </>
    ),
    subtitle: 'Deixe em branco o que preferir definir depois.',
  },
  negocio: {
    title: (
      <>
        Como se chama o seu <Em>negócio</Em>?
      </>
    ),
    subtitle: 'Último passo. O resto você ajusta depois, no painel.',
  },
}

// quem atende sozinha precisa estar na agenda: o nome não pode ser pulado
const SKIPPABLE: StepId[] = ['precos']

/** /cadastro/salao: questionário em passos que já monta o negócio conforme o setor de beleza */
export default function Onboarding() {
  const { status, session, createSalon, signOut } = useAuth()
  const [index, setIndex] = useState(0)
  const [segments, setSegments] = useState<string[]>([])
  const [team, setTeam] = useState<TeamSize | null>(null)
  // já vem com o nome do cadastro (Google ou formulário), quando houver
  const [proName, setProName] = useState(() => {
    const meta = session?.user.user_metadata?.displayName
    return typeof meta === 'string' ? meta.trim() : ''
  })
  const [picked, setPicked] = useState<string[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = useMemo(() => SEGMENTS.filter((s) => segments.includes(s.id)), [segments])
  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = ['segmentos', 'equipe']
    if (team === 'solo') list.push('profissional')
    list.push('servicos')
    if (picked.length > 0) list.push('precos')
    list.push('negocio')
    return list
  }, [team, picked.length])

  if (status === 'signed-out') return <Navigate to={ROUTES.login} replace />
  if (status === 'no-salon' && pendingInvite()) return <Navigate to={noSalonPath()} replace />
  if (status === 'ready' || status === 'demo') return <Navigate to={ROUTES.dashboard} replace />

  const step = steps[Math.min(index, steps.length - 1)]
  const last = step === 'negocio'
  const copy = COPY[step]

  const toggleSegment = (id: string) => {
    const segment = SEGMENTS.find((s) => s.id === id)
    if (!segment) return
    const ids = segment.services.map((s) => s.id)
    if (segments.includes(id)) {
      setSegments(segments.filter((s) => s !== id))
      setPicked(picked.filter((p) => !ids.includes(p)))
    } else {
      setSegments([...segments, id])
      setPicked([...picked, ...ids])
    }
  }

  const togglePicked = (id: string) => setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])

  const next = () => {
    setError(null)
    setIndex(index + 1)
  }
  const back = () => {
    setError(null)
    setIndex(Math.max(0, index - 1))
  }
  const skip = () => {
    if (step === 'precos') setPrices({})
    next()
  }

  const onName = (value: string) => {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  const canContinue =
    step === 'segmentos' ? segments.length > 0 : step === 'equipe' ? team !== null : step === 'profissional' ? proName.trim().length >= 2 : true

  const buildSetup = (): SalonSetup => ({
    services: chosen.flatMap((segment) =>
      segment.services
        .filter((s) => picked.includes(s.id))
        .map((s) => {
          const price = Number((prices[s.id] ?? '').replace(',', '.'))
          return { name: s.name, category: segment.category, price: Number.isFinite(price) && price > 0 ? price : 0, duration: s.duration }
        }),
    ),
    professionalName: team === 'solo' && proName.trim().length >= 2 ? proName.trim() : undefined,
    plan: team ? PLAN_FOR_TEAM[team] : undefined,
  })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!last) {
      if (canContinue) next()
      return
    }
    setError(null)
    if (slug.length < 3) {
      setError('O endereço precisa ter pelo menos 3 caracteres.')
      return
    }
    if (isReservedSlug(slug)) {
      setError('Esse endereço é reservado. Escolha outro.')
      return
    }
    setBusy(true)
    setError(await createSalon(name, slug, buildSetup()))
    setBusy(false)
  }

  return (
    <AuthLayout>
      <form className="wiz" onSubmit={onSubmit}>
        <div className="wiz__bar">
          <button type="button" className="wiz__back" onClick={back} disabled={index === 0} aria-label="Voltar">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div
            className="wiz__progress"
            role="progressbar"
            aria-label="Progresso"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={index + 1}
          >
            {steps.map((id, i) => (
              <span key={id} className={i <= index ? 'is-done' : undefined} />
            ))}
          </div>
          {SKIPPABLE.includes(step) ? (
            <button type="button" className="wiz__skip" onClick={skip}>
              Pular
            </button>
          ) : (
            <span className="wiz__skip" aria-hidden="true" />
          )}
        </div>

        <p className="wiz__eyebrow">Sobre o seu negócio</p>
        <h1 className="auth__title">{copy.title}</h1>
        {copy.subtitle && <p className="card__sub">{copy.subtitle}</p>}

        {step === 'segmentos' && (
          <div className="wiz__options">
            {SEGMENTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="wiz__opt"
                aria-pressed={segments.includes(s.id)}
                onClick={() => toggleSegment(s.id)}
              >
                {segments.includes(s.id) && <Check size={16} aria-hidden="true" />}
                {s.label}
              </button>
            ))}
          </div>
        )}

        {step === 'equipe' && (
          <div className="wiz__options">
            {TEAM_SIZES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="wiz__opt"
                aria-pressed={team === t.id}
                onClick={() => {
                  setTeam(t.id)
                  next()
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {step === 'profissional' && (
          <AuthField
            label="Seu nome"
            icon={<User size={16} />}
            autoComplete="name"
            maxLength={80}
            value={proName}
            onChange={(e) => setProName(e.target.value)}
          />
        )}

        {step === 'servicos' &&
          chosen.map((segment) => (
            <div key={segment.id} className="wiz__group">
              <p className="wiz__group-title">{segment.label}</p>
              <div className="wiz__options">
                {segment.services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="wiz__opt"
                    aria-pressed={picked.includes(s.id)}
                    onClick={() => togglePicked(s.id)}
                  >
                    {picked.includes(s.id) && <Check size={16} aria-hidden="true" />}
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          ))}

        {step === 'precos' && (
          <div className="wiz__prices">
            {chosen.flatMap((segment) =>
              segment.services
                .filter((s) => picked.includes(s.id))
                .map((s) => (
                  <label key={s.id} className="wiz__price">
                    <span>
                      {s.name}
                      <small>{s.duration} min</small>
                    </span>
                    <span className="input">
                      <span className="wiz__cur">R$</span>
                      <input
                        inputMode="decimal"
                        placeholder="0,00"
                        aria-label={`Preço de ${s.name}`}
                        value={prices[s.id] ?? ''}
                        onChange={(e) => setPrices({ ...prices, [s.id]: e.target.value.replace(/[^\d,.]/g, '') })}
                      />
                    </span>
                  </label>
                )),
            )}
          </div>
        )}

        {step === 'negocio' && (
          <>
            <AuthField
              label="Nome do negócio"
              required
              minLength={2}
              maxLength={60}
              autoComplete="organization"
              value={name}
              onChange={(e) => onName(e.target.value)}
            />
            <AuthField
              label={`Endereço da sua página (.${SITE_DOMAIN})`}
              required
              minLength={3}
              maxLength={40}
              pattern={SLUG_PATTERN}
              title="Use letras minúsculas, números e hífen"
              hint={siteHost(slug)}
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }}
            />
          </>
        )}

        <FormMessages error={error} />

        <div className="auth__foot">
          <button type="button" className="textlink" onClick={() => void signOut()}>
            Sair desta conta
          </button>
          {step !== 'equipe' && (
            <button
              type="submit"
              className="auth__go"
              disabled={busy || !canContinue}
              aria-label={last ? (busy ? 'Criando…' : 'Criar meu negócio') : 'Continuar'}
              title={last ? 'Criar meu negócio' : 'Continuar'}
            >
              {last ? <Check size={22} aria-hidden="true" /> : <ArrowRight size={22} aria-hidden="true" />}
            </button>
          )}
        </div>
      </form>
    </AuthLayout>
  )
}

import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, User } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { ROUTES } from '../../lib/routes'
import { isReservedSlug, SITE_DOMAIN, SLUG_PATTERN, siteHost, slugify } from '../../lib/slug'
import { OTHER_SEGMENT, SEGMENTS, TEAM_SIZES, type SalonSetup, type Segment, type TeamSize } from '../../lib/segments'
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
    subtitle: 'Marcamos os mais comuns. Tire o que você não faz e adicione o que faltar.',
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

/** duração inicial de um serviço digitado pela pessoa; ela ajusta no painel */
const CUSTOM_DURATION = 60

interface CustomService {
  id: string
  name: string
  segmentId: string
}

/** /cadastro/salao: questionário em passos que já monta o negócio conforme o setor de beleza */
export default function Onboarding() {
  const { status, session, createSalon, signOut } = useAuth()
  const [index, setIndex] = useState(0)
  const [segments, setSegments] = useState<string[]>([])
  // "Outro": área que não está na lista (ex.: maquiagem); os serviços dela entram na categoria "Outros"
  const [otherLabel, setOtherLabel] = useState('')
  // serviços digitados no passo de serviços, por área
  const [customs, setCustoms] = useState<CustomService[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
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

  // áreas marcadas, já com os serviços digitados no fim de cada uma
  const chosen = useMemo<Segment[]>(() => {
    const base = SEGMENTS.filter((s) => segments.includes(s.id))
    if (segments.includes(OTHER_SEGMENT.id)) base.push({ ...OTHER_SEGMENT, label: otherLabel.trim() || OTHER_SEGMENT.label })
    return base.map((segment) => ({
      ...segment,
      services: [
        ...segment.services,
        ...customs.filter((c) => c.segmentId === segment.id).map((c) => ({ id: c.id, name: c.name, duration: CUSTOM_DURATION })),
      ],
    }))
  }, [segments, otherLabel, customs])
  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = ['segmentos', 'equipe']
    if (team === 'solo') list.push('profissional')
    list.push('servicos')
    if (picked.length > 0) list.push('precos')
    list.push('negocio')
    return list
  }, [team, picked.length])

  if (status === 'signed-out') return <Navigate to={ROUTES.login} replace />
  if (status === 'demo') return <Navigate to={ROUTES.dashboard} replace />
  // negócio criado: segue para a escolha do plano (quem já escolheu é mandada de lá para o dashboard)
  if (status === 'ready') return <Navigate to={ROUTES.choosePlan} replace />

  const step = steps[Math.min(index, steps.length - 1)]
  const last = step === 'negocio'
  const copy = COPY[step]

  const toggleSegment = (id: string) => {
    const segment = [...SEGMENTS, OTHER_SEGMENT].find((s) => s.id === id)
    if (!segment) return
    const ids = [...segment.services, ...customs.filter((c) => c.segmentId === id)].map((s) => s.id)
    if (segments.includes(id)) {
      setSegments(segments.filter((s) => s !== id))
      setPicked(picked.filter((p) => !ids.includes(p)))
    } else {
      setSegments([...segments, id])
      setPicked([...picked, ...ids])
    }
  }

  const togglePicked = (id: string) => setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])

  const addCustom = (segmentId: string) => {
    const name = (drafts[segmentId] ?? '').trim().replace(/\s+/g, ' ')
    if (name.length < 2) return
    setDrafts({ ...drafts, [segmentId]: '' })
    const group = chosen.find((g) => g.id === segmentId)
    const same = group?.services.find((s) => s.name.toLowerCase() === name.toLowerCase())
    // nome repetido só volta a marcar o que já existe
    if (same) {
      if (!picked.includes(same.id)) setPicked([...picked, same.id])
      return
    }
    // a lista só cresce, então o tamanho dela basta para o id ser único
    const id = `custom-${customs.length}`
    setCustoms([...customs, { id, name: name.slice(0, 60), segmentId }])
    setPicked([...picked, id])
  }

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
    step === 'segmentos'
      ? segments.length > 0 && (!segments.includes(OTHER_SEGMENT.id) || otherLabel.trim().length >= 2)
      : step === 'equipe' ? team !== null : step === 'profissional' ? proName.trim().length >= 2 : true

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
            {[...SEGMENTS, OTHER_SEGMENT].map((s) => (
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

        {step === 'segmentos' && segments.includes(OTHER_SEGMENT.id) && (
          <AuthField
            label="Qual? Ex.: Maquiagem, Depilação a laser"
            maxLength={40}
            autoFocus
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
          />
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
              <div className="wiz__add">
                <AuthField
                  label={segment.services.length > 0 ? 'Outro serviço' : 'Nome do serviço'}
                  aria-label={`Adicionar serviço em ${segment.label}`}
                  maxLength={60}
                  value={drafts[segment.id] ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [segment.id]: e.target.value })}
                  onKeyDown={(e) => {
                    // Enter adiciona o serviço em vez de avançar o questionário
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustom(segment.id)
                    }
                  }}
                  action={
                    <button
                      type="button"
                      className="wiz__add-btn"
                      onClick={() => addCustom(segment.id)}
                      disabled={(drafts[segment.id] ?? '').trim().length < 2}
                      aria-label="Adicionar serviço"
                      title="Adicionar serviço"
                    >
                      <Plus size={18} aria-hidden="true" />
                    </button>
                  }
                />
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

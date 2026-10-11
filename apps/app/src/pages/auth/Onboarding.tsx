import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Check, User, X } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { neon } from '../../lib/neon'
import { CHOSEN_PLAN_KEY, isPlanId } from '../../lib/plans'
import { ROUTES } from '../../lib/routes'
import { isReservedSlug, SITE_DOMAIN, SLUG_PATTERN, slugify } from '../../lib/slug'
import { OTHER_SEGMENT, SEGMENTS, starterServices } from '../../lib/segments'
import { Em } from '../../components/ui'
import { AuthField, AuthLayout, FormMessages } from './AuthLayout'

/** rascunho guardado no aparelho: sair para responder um WhatsApp e voltar não apaga o que já foi preenchido */
const DRAFT_KEY = 'ikizy:cadastro-negocio'

interface Draft {
  name: string
  slug: string
  slugTouched: boolean
  segments: string[]
  otherLabel: string
  ownerName: string
}

function readDraft(): Partial<Draft> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as Partial<Draft>
  } catch {
    return {}
  }
}

/**
 * /cadastro/salao: uma tela só. Nome do negócio (o link sai dele), o que faz e quem atende.
 * O resto (serviços sem preço, horário 9h–19h, a dona na agenda, teste grátis) o sistema monta sozinho,
 * e os ajustes ficam nos primeiros passos dentro do sistema.
 */
export default function Onboarding() {
  const { status, session, createSalon, signOut } = useAuth()
  const saved = readDraft()
  // nome da conta (cadastro ou Google); só pergunta quando não veio
  const meta = session?.user.user_metadata?.displayName
  const accountName = typeof meta === 'string' ? meta.trim() : ''
  const [name, setName] = useState(saved.name ?? '')
  const [slug, setSlug] = useState(saved.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(saved.slugTouched ?? false)
  const [editingSlug, setEditingSlug] = useState(false)
  const [segments, setSegments] = useState<string[]>(saved.segments ?? [])
  const [otherLabel, setOtherLabel] = useState(saved.otherLabel ?? '')
  const [ownerName, setOwnerName] = useState(saved.ownerName ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // null = ainda não conferido (ou o banco ainda não tem a função): o erro aparece ao criar, como antes
  const [taken, setTaken] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, slug, slugTouched, segments, otherLabel, ownerName } satisfies Draft))
    } catch {
      // sem armazenamento: o rascunho vale só nesta visita
    }
  }, [name, slug, slugTouched, segments, otherLabel, ownerName])

  // confere o link enquanto a pessoa digita (meio segundo depois de parar)
  useEffect(() => {
    if (!neon || slug.length < 3 || isReservedSlug(slug)) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void neon!.rpc('slug_available', { p_slug: slug }).then(({ data, error: err }) => {
        if (!cancelled && !err) setTaken(data === false ? slug : null)
      })
    }, 500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [slug])

  if (status === 'signed-out') return <Navigate to={ROUTES.login} replace />
  if (status === 'demo') return <Navigate to={ROUTES.dashboard} replace />
  // negócio criado: direto para a agenda
  if (status === 'ready') return <Navigate to={ROUTES.dashboard} replace />

  const onName = (value: string) => {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }
  const toggle = (id: string) => setSegments(segments.includes(id) ? segments.filter((s) => s !== id) : [...segments, id])
  const slugError =
    slug.length > 0 && slug.length < 3
      ? 'O link precisa ter pelo menos 3 letras.'
      : isReservedSlug(slug)
        ? 'Esse link é reservado. Escolha outro.'
        : taken === slug
          ? 'Esse link já está em uso. Troque por outro.'
          : null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const person = (accountName || ownerName).trim()
    if (person.length < 2) return setError('Conte como você se chama.')
    if (name.trim().length < 2) return setError('Dê um nome ao seu negócio.')
    if (slugError || slug.length < 3) {
      setEditingSlug(true)
      return setError(slugError ?? 'O link precisa ter pelo menos 3 letras.')
    }
    if (segments.length === 0) return setError('Marque o que você faz.')
    if (segments.includes(OTHER_SEGMENT.id) && otherLabel.trim().length < 2) return setError('Conte qual é a outra área.')

    setBusy(true)
    const message = await create(name.trim(), slug, starterServices(segments), person)
    setBusy(false)
    if (message) {
      if (message.includes('endereço')) setEditingSlug(true)
      setError(message.replace('Este endereço', 'Este link').replace('Esse endereço', 'Esse link'))
    }
  }

  /** plano escolhido no cadastro (ou o mais escolhido) e fim do rascunho */
  const create = async (bizName: string, bizSlug: string, services: ReturnType<typeof starterServices>, person: string) => {
    let plan: 'solo' | 'studio' | 'salao' = 'studio'
    try {
      const fromSite = localStorage.getItem(CHOSEN_PLAN_KEY)
      if (isPlanId(fromSite)) plan = fromSite
    } catch {
      // sem armazenamento: vale o plano mais escolhido
    }
    const message = await createSalon(bizName, bizSlug, { services, professionalName: person, plan })
    if (!message) {
      try {
        localStorage.removeItem(DRAFT_KEY)
        localStorage.removeItem(CHOSEN_PLAN_KEY)
      } catch {
        // nada a limpar
      }
    }
    return message
  }

  /**
   * "Pular etapa": cria o negócio com nome e link provisórios (a partir do nome da pessoa) e sem serviços.
   * Nome do negócio, link e serviços se ajustam depois, em Meu negócio e Meu site.
   */
  const onSkip = async () => {
    setError(null)
    const person = (accountName || ownerName).trim()
    if (person.length < 2) return setError('Conte como você se chama.')
    const first = person.split(/\s+/)[0]
    const bizName = `Studio ${first}`
    setBusy(true)
    let message: string | null = null
    for (let i = 0; i < 3; i++) {
      const suffix = String(Math.floor(1000 + Math.random() * 9000))
      message = await create(bizName, `${slugify(bizName) || 'studio'}-${suffix}`, [], person)
      if (!message || !message.includes('endereço')) break
    }
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <AuthLayout
      topAction={
        <button type="button" className="auth__close" aria-label="Fechar e sair desta conta" title="Fechar e sair desta conta" onClick={() => void signOut()}>
          <X size={24} strokeWidth={1.5} aria-hidden="true" />
        </button>
      }
    >
      <form className="wiz" onSubmit={onSubmit}>
        <p className="wiz__eyebrow">Último passo</p>
        <h1 className="auth__title">
          <Em>Seu</Em> negócio
        </h1>
        <p className="card__sub">Pode pular: o resto você ajusta depois, já com a agenda na frente.</p>

        {!accountName && (
          <AuthField
            label="Seu nome"
            icon={<User size={16} />}
            autoComplete="name"
            maxLength={80}
            placeholder="Como as clientes te chamam"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        )}

        <AuthField
          label="Nome do negócio"
          required
          minLength={2}
          maxLength={60}
          autoComplete="organization"
          placeholder="Ex.: Studio Maria Beauty"
          value={name}
          onChange={(e) => onName(e.target.value)}
        />
        {editingSlug ? (
          <AuthField
            label="Link da sua página"
            minLength={3}
            maxLength={40}
            pattern={SLUG_PATTERN}
            title="Use letras minúsculas, números e hífen"
            hint={`${slug || 'seu-negocio'}.${SITE_DOMAIN}`}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            }}
          />
        ) : (
          <p className="wiz__link">
            Seu link: <strong>{slug || 'seu-negocio'}.{SITE_DOMAIN}</strong>{' '}
            <button type="button" className="textlink" onClick={() => setEditingSlug(true)}>
              Trocar
            </button>
          </p>
        )}
        {slugError && <p className="field__hint wiz__warn">{slugError}</p>}

        <p className="wiz__q">O que você faz?</p>
        <div className="wiz__options">
          {[...SEGMENTS, OTHER_SEGMENT].map((s) => (
            <button key={s.id} type="button" className="wiz__opt" aria-pressed={segments.includes(s.id)} onClick={() => toggle(s.id)}>
              {segments.includes(s.id) && <Check size={16} aria-hidden="true" />}
              {s.label}
            </button>
          ))}
        </div>
        {segments.includes(OTHER_SEGMENT.id) && (
          <AuthField label="Qual?" maxLength={40} placeholder="Ex.: Maquiagem, Depilação a laser" value={otherLabel} onChange={(e) => setOtherLabel(e.target.value)} />
        )}

        <FormMessages error={error} />

        <div className="auth__foot">
          <button type="button" className="textlink" onClick={() => void onSkip()} disabled={busy}>
            Pular etapa
          </button>
          <button type="submit" className="auth__go" disabled={busy} aria-label={busy ? 'Criando…' : 'Criar meu negócio'} title="Criar meu negócio">
            <Check size={22} aria-hidden="true" />
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}

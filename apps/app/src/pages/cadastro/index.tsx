import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useOnboardingDraft, useSlugCheck } from '../../data/onboarding'
import {
  addService,
  hoursForDb,
  isStepId,
  neighbors,
  reachableStep,
  removeService,
  reviewGroups,
  serviceCount,
  starterFromGroups,
  stepProblem,
  stepsFor,
  suggestedPlan,
  weekHours,
  type OnboardingAnswers,
  type StepId,
} from '../../domain/onboarding'
import { summarizeHours } from '../../domain/business'
import { CHOSEN_PLAN_KEY } from '../../lib/plans'
import { ROUTES } from '../../lib/routes'
import { noSalonPath, readPendingInvite } from '../../lib/pendingInvite'
import { isReservedSlug, siteHost, slugify } from '../../lib/slug'
import { DraftPreview } from './AppPreview'
import { BUILD_TICK_MS, Building, Ready } from './Finale'
import { OnboardingShell, Question } from './OnboardingShell'
import { StepAreas } from './StepAreas'
import { StepName, StepYou } from './StepBasics'
import { StepHours } from './StepHours'
import { StepServices } from './StepServices'
import { StepTeam } from './StepTeam'

type Phase = 'ask' | 'building' | 'ready'

const COPY: Record<StepId, { title: string; subtitle: string }> = {
  voce: { title: 'Como você se chama?', subtitle: 'É o nome que aparece na sua agenda.' },
  nome: { title: 'Como se chama seu negócio?', subtitle: 'Seu site e seu link de agendamento saem daqui.' },
  areas: { title: 'O que você faz?', subtitle: 'Escolha uma ou mais áreas. Com isso já deixamos seus serviços prontos.' },
  equipe: { title: 'Quem atende?', subtitle: 'Muda o jeito da sua agenda. Dá para trocar depois.' },
  horario: { title: 'Quando você atende?', subtitle: 'Marque os dias e o horário. Almoço e folgas você ajusta depois.' },
  servicos: { title: 'Revise seus serviços', subtitle: 'Tire o que não faz e ponha o que faltou. Os preços entram depois, com a agenda na frente.' },
}

/** o plano que veio de um cartão do site (ikizy.com/precos → /cadastro?plano=studio) */
function sitePlan(): string | null {
  try {
    return localStorage.getItem(CHOSEN_PLAN_KEY)
  } catch {
    return null
  }
}

/**
 * /cadastro/salao: o negócio em perguntas curtas, uma por tela, com o sistema se montando ao fundo.
 * No fim cria tudo de uma vez (R-11), mostra o que ficou pronto e leva para a escolha do plano.
 */
export default function Onboarding() {
  const { status, session, createSalon } = useAuth()
  const { draft, patch } = useOnboardingDraft()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('ask')
  const [error, setError] = useState<string | null>(null)

  // nome da conta (cadastro ou Google); só pergunta quando não veio
  const meta = session?.user.user_metadata?.displayName
  const accountName = typeof meta === 'string' ? meta.trim() : ''
  const person = (accountName || draft.ownerName).trim()
  const slugCheck = useSlugCheck(draft.slug)
  const groups = useMemo(
    () => reviewGroups(draft.segments, draft.otherLabel, draft.removed, draft.added),
    [draft.segments, draft.otherLabel, draft.removed, draft.added],
  )

  if (status === 'signed-out') return <Navigate to={ROUTES.login} replace />
  // veio de um convite da equipe: entra no negócio de quem convidou em vez de criar um
  if (status === 'no-salon' && phase === 'ask' && readPendingInvite()) return <Navigate to={noSalonPath()} replace />
  if (status === 'loading') {
    return (
      <div className="splash" role="status" aria-live="polite">
        <span className="splash__logo">
          IKIZY<span className="logo__dot">.</span>
        </span>
        <span className="sr-only">Carregando…</span>
      </div>
    )
  }
  // negócio já existe (e não foi criado agora): a tela de planos decide se ainda falta escolher
  if (status === 'ready' && phase === 'ask') return <Navigate to={ROUTES.choosePlan} replace />

  const answers: OnboardingAnswers = {
    ...draft,
    ownerName: person,
    slugTaken: slugCheck === 'taken',
    serviceCount: serviceCount(groups),
  }
  const reserved = isReservedSlug(draft.slug)
  const steps = stepsFor(!accountName)
  const asked = params.get('passo')
  const step = reachableStep(steps, isStepId(asked) ? asked : steps[0], answers, reserved)
  const { prev, next } = neighbors(steps, step)

  const go = (s: StepId) => {
    setError(null)
    setParams({ passo: s })
  }

  const create = async () => {
    setPhase('building')
    setError(null)
    // a montagem aparece inteira mesmo quando o banco responde rápido
    const [message] = await Promise.all([
      createSalon(draft.name.trim(), draft.slug, {
        services: starterFromGroups(groups),
        professionalName: person,
        plan: suggestedPlan(draft.team, sitePlan()),
        hours: hoursForDb(draft.days, draft.start, draft.end),
      }),
      new Promise((resolve) => window.setTimeout(resolve, BUILD_TICK_MS * 4)),
    ])
    if (message) {
      setPhase('ask')
      // link tomado por outra pessoa no meio do caminho: volta ao nome para trocar
      if (message.includes('endereço')) go('nome')
      setError(message.replace('Este endereço', 'Este link').replace('Esse endereço', 'Esse link'))
      return
    }
    setPhase('ready')
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const problem = stepProblem(step, answers, reserved)
    if (problem) return setError(problem)
    if (next) go(next)
    else void create()
  }

  const backdrop = <DraftPreview draft={draft} ownerName={person} phase={phase === 'ask' ? 'blank' : phase} />

  if (phase !== 'ask') {
    return (
      <OnboardingShell backdrop={backdrop}>
        {phase === 'building' ? (
          <Question key="building" title="Montando sua agenda…" subtitle="Leva só um instante.">
            <Building />
          </Question>
        ) : (
          <Question key="ready" title="Sua agenda está pronta" subtitle="Você ajusta tudo depois, na aba Negócio. Falta só escolher o plano.">
            <Ready
              serviceCount={serviceCount(groups)}
              hours={summarizeHours(weekHours(draft.days, draft.start, draft.end))}
              site={siteHost(draft.slug)}
              onContinue={() => navigate(ROUTES.choosePlan)}
            />
          </Question>
        )}
      </OnboardingShell>
    )
  }

  const onName = (value: string) => patch(draft.slugTouched ? { name: value } : { name: value, slug: slugify(value) })

  const body: Record<StepId, ReactNode> = {
    voce: <StepYou value={draft.ownerName} onChange={(ownerName) => patch({ ownerName })} />,
    nome: (
      <StepName
        name={draft.name}
        slug={draft.slug}
        slugCheck={slugCheck}
        onName={onName}
        onSlug={(slug) => patch({ slug, slugTouched: true })}
      />
    ),
    areas: <StepAreas segments={draft.segments} otherLabel={draft.otherLabel} onChange={(segments, otherLabel) => patch({ segments, otherLabel })} />,
    equipe: <StepTeam value={draft.team} onChange={(team) => patch({ team })} />,
    horario: <StepHours days={draft.days} start={draft.start} end={draft.end} onChange={patch} />,
    servicos: (
      <StepServices
        groups={groups}
        onRemove={(change) => patch(removeService(draft.removed, draft.added, change))}
        onAdd={(change) => {
          const result = addService(groups, draft.removed, draft.added, change)
          if ('error' in result) return result.error
          patch(result)
          return null
        }}
      />
    ),
  }

  return (
    <OnboardingShell backdrop={backdrop} onBack={prev ? () => go(prev) : undefined} size={step === 'horario' || step === 'servicos' ? 'md' : undefined}>
      <Question key={step} title={COPY[step].title} subtitle={COPY[step].subtitle} progress={[steps.indexOf(step) + 1, steps.length]}>
        <form className="onb__form" onSubmit={onSubmit} noValidate>
          {body[step]}
          {error && (
            <p className="onb__error" role="alert">
              {error}
            </p>
          )}
        </form>
      </Question>
    </OnboardingShell>
  )
}

import { useEffect, useState } from 'react'
import { DEFAULT_DAYS, DEFAULT_END, DEFAULT_START, type ServiceChange, type Team } from '../domain/onboarding'
import { neon } from '../lib/neon'
import { isReservedSlug } from '../lib/slug'

/**
 * Rascunho do cadastro do negócio, guardado no aparelho: sair para responder um WhatsApp e voltar não apaga nada.
 * Fica até a dona escolher o plano (a tela de planos ainda usa a resposta da equipe).
 */
const DRAFT_KEY = 'ikizy:cadastro-negocio'

export interface OnboardingDraft {
  ownerName: string
  name: string
  slug: string
  /** a pessoa mexeu no link: ele para de acompanhar o nome */
  slugTouched: boolean
  segments: string[]
  otherLabel: string
  team: Team | null
  days: number[]
  start: number
  end: number
  /** serviços comuns que a pessoa tirou e os que digitou, por área */
  removed: ServiceChange[]
  added: ServiceChange[]
}

const EMPTY: OnboardingDraft = {
  ownerName: '',
  name: '',
  slug: '',
  slugTouched: false,
  segments: [],
  otherLabel: '',
  team: null,
  days: DEFAULT_DAYS,
  start: DEFAULT_START,
  end: DEFAULT_END,
  removed: [],
  added: [],
}

export function readOnboardingDraft(): OnboardingDraft {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as Partial<OnboardingDraft>
    return { ...EMPTY, ...saved }
  } catch {
    return EMPTY
  }
}

export function clearOnboardingDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // nada a limpar
  }
}

/** o rascunho e uma função para mudar partes dele; cada mudança já fica guardada */
export function useOnboardingDraft() {
  const [draft, setDraft] = useState<OnboardingDraft>(readOnboardingDraft)
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // sem armazenamento: o rascunho vale só nesta visita
    }
  }, [draft])
  const patch = (p: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...p }))
  return { draft, patch }
}

export type SlugCheck = 'idle' | 'checking' | 'free' | 'taken'

/** confere no banco se o link está livre, meio segundo depois de parar de digitar */
export function useSlugCheck(slug: string): SlugCheck {
  const [result, setResult] = useState<{ slug: string; state: SlugCheck }>({ slug: '', state: 'idle' })
  const checkable = Boolean(neon) && slug.length >= 3 && !isReservedSlug(slug)
  useEffect(() => {
    if (!checkable) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void neon!.rpc('slug_available', { p_slug: slug }).then(({ data, error }) => {
        // sem a função no banco: não diz nada (o erro aparece ao criar, como antes)
        if (!cancelled) setResult({ slug, state: error ? 'idle' : data === false ? 'taken' : 'free' })
      })
    }, 500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [slug, checkable])
  if (!checkable) return 'idle'
  return result.slug === slug ? result.state : 'checking'
}

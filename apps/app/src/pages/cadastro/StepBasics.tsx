import { useState } from 'react'
import { Check, Loader2, Store, User } from 'lucide-react'
import type { SlugCheck } from '../../data/onboarding'
import { SITE_DOMAIN } from '../../lib/slug'
import { Ask } from './Ask'
import './StepBasics.css'

/** "Como você se chama?": só para conta que veio sem nome */
export function StepYou({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Ask icon={<User size={20} />} goLabel="Continuar">
      <input
        className="ask__input"
        aria-label="Seu nome"
        placeholder="Seu nome"
        autoComplete="name"
        autoFocus
        maxLength={80}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Ask>
  )
}

const SLUG_STATE: Record<SlugCheck, string> = {
  idle: '',
  checking: 'conferindo…',
  free: 'livre',
  taken: 'já está em uso',
}

/** nome do negócio; o link sai dele e é conferido enquanto a pessoa digita */
export function StepName({
  name,
  slug,
  slugCheck,
  onName,
  onSlug,
}: {
  name: string
  slug: string
  slugCheck: SlugCheck
  onName: (v: string) => void
  onSlug: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <Ask icon={<Store size={20} />} goLabel="Continuar">
        <input
          className="ask__input"
          aria-label="Nome do negócio"
          placeholder="Ex.: Studio Maria Beauty"
          autoComplete="organization"
          autoFocus
          maxLength={60}
          value={name}
          onChange={(e) => onName(e.target.value)}
        />
      </Ask>
      <div className="onb-link">
        {editing ? (
          <label className="onb-link__edit">
            <span className="sr-only">Link do seu site</span>
            <input
              value={slug}
              maxLength={40}
              autoFocus
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => onSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
            <span>.{SITE_DOMAIN}</span>
          </label>
        ) : (
          <span>
            Seu link: <b>{slug || 'seu-negocio'}.{SITE_DOMAIN}</b>
          </span>
        )}
        {slug.length >= 3 && slugCheck !== 'idle' && (
          <span className={`onb-link__state onb-link__state--${slugCheck}`} aria-live="polite">
            {slugCheck === 'free' && <Check size={14} aria-hidden="true" />}
            {slugCheck === 'checking' && <Loader2 size={14} className="ask__spin" aria-hidden="true" />}
            {SLUG_STATE[slugCheck]}
          </span>
        )}
        <button type="button" className="onb-link__btn" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Pronto' : 'Trocar'}
        </button>
      </div>
    </>
  )
}

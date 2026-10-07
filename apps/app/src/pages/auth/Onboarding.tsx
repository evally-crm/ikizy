import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { ROUTES } from '../../lib/routes'
import { isReservedSlug, SITE_DOMAIN, SLUG_PATTERN, siteHost, slugify } from '../../lib/slug'
import { Button, Em } from '../../components/ui'
import { AuthCard, AuthField, AuthLayout, FormMessages } from './AuthLayout'

/** /cadastro/salao: depois de criar a conta, a pessoa cria o negócio dela */
export default function Onboarding() {
  const { status, createSalon, signOut } = useAuth()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'signed-out') return <Navigate to={ROUTES.login} replace />
  if (status === 'ready' || status === 'demo') return <Navigate to={ROUTES.dashboard} replace />

  const onName = (value: string) => {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
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
    setError(await createSalon(name, slug))
    setBusy(false)
  }

  return (
    <AuthLayout>
      <AuthCard
        title={
          <>
            Vamos montar o seu <Em>negócio</Em>
          </>
        }
        subtitle="Só duas informações. O resto você ajusta depois, no painel."
      >
        <form className="form" onSubmit={onSubmit}>
          <AuthField
            label="Nome do salão"
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
          <FormMessages error={error} />
          <Button type="submit" disabled={busy}>
            <Rocket size={16} aria-hidden="true" />
            {busy ? 'Criando…' : 'Criar meu negócio'}
          </Button>
        </form>

        <p className="auth__switch">
          <button type="button" className="textlink" onClick={() => void signOut()}>
            Sair desta conta
          </button>
        </p>
      </AuthCard>
    </AuthLayout>
  )
}

import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { AuthField, AuthLayout } from './Auth'
import { Button, Card, Em } from '../components/ui'

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

export default function Onboarding() {
  const { status, createSalon, signOut } = useAuth()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'signed-out') return <Navigate to="/entrar" replace />
  if (status === 'ready' || status === 'demo') return <Navigate to="/" replace />

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
    setBusy(true)
    setError(await createSalon(name, slug))
    setBusy(false)
  }

  return (
    <AuthLayout>
      <Card className="auth__card">
        <h1 className="auth__title">
          Vamos montar o seu <Em>salão</Em>
        </h1>
        <p className="card__sub">Só duas informações. O resto você ajusta depois em “Meu site”.</p>

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
            label="Endereço da sua página"
            required
            minLength={3}
            maxLength={40}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Use letras minúsculas, números e hífen"
            hint={`evally.app/${slug || 'seu-salao'}`}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            }}
          />
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            <Rocket size={16} aria-hidden="true" />
            {busy ? 'Criando…' : 'Criar meu salão'}
          </Button>
        </form>

        <p className="auth__switch">
          <button type="button" className="textlink" onClick={() => void signOut()}>
            Sair desta conta
          </button>
        </p>
      </Card>
    </AuthLayout>
  )
}

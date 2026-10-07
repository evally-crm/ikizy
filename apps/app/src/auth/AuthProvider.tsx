import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isNeonConfigured, neon, type NeonSession as Session } from '../lib/neon'
import { dash, ROUTES } from '../lib/routes'
import type { SalonSetup } from '../lib/segments'

export type MemberRole = 'owner' | 'manager' | 'reception' | 'professional'

export interface Salon {
  id: string
  name: string
  slug: string
  role: MemberRole
}

/** demo: sem Neon configurado · loading: resolvendo sessão/salão */
export type AuthStatus = 'demo' | 'loading' | 'signed-out' | 'no-salon' | 'ready'

interface AuthState {
  status: AuthStatus
  session: Session | null
  salon: Salon | null
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  /** envia o e-mail de recuperação; a resposta é sempre a mesma para não revelar se o e-mail existe */
  sendPasswordReset: (email: string) => Promise<string | null>
  /** token vem do link do e-mail (?token=...); o Neon Auth não abre sessão no link de recuperação */
  updatePassword: (password: string, token: string) => Promise<string | null>
  /** abre o login do Google; ao voltar, a sessão é restaurada e o dashboard decide entre salão ou onboarding */
  signInWithGoogle: () => Promise<string | null>
  signOut: () => Promise<void>
  /** cria o negócio e, se houver `setup`, já cadastra serviços e a profissional sugeridos pelo questionário */
  createSalon: (name: string, slug: string, setup?: SalonSetup) => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [salon, setSalon] = useState<Salon | null>(null)
  const [sessionReady, setSessionReady] = useState(!isNeonConfigured)
  const [salonReady, setSalonReady] = useState(!isNeonConfigured)

  // sessão
  useEffect(() => {
    if (!neon) return
    neon.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionReady(true)
    })
    // o callback só atualiza estado: chamar o cliente aqui dentro pode travar
    const { data } = neon.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const loadSalon = useCallback(async (uid: string) => {
    if (!neon) return
    const { data, error } = await neon
      .from('members')
      .select('role, salons ( id, name, slug )')
      .eq('user_id', uid)
      .limit(1)
      .maybeSingle()
    const joined = data?.salons as unknown as { id: string; name: string; slug: string } | null
    setSalon(!error && data && joined ? { ...joined, role: data.role as MemberRole } : null)
    setSalonReady(true)
  }, [])

  // salão do usuário logado
  useEffect(() => {
    if (!isNeonConfigured || !sessionReady) return
    if (!userId) {
      setSalon(null)
      setSalonReady(true)
      return
    }
    setSalonReady(false)
    void loadSalon(userId)
  }, [userId, sessionReady, loadSalon])

  const status: AuthStatus = !isNeonConfigured
    ? 'demo'
    : !sessionReady || (userId && !salonReady)
      ? 'loading'
      : !session
        ? 'signed-out'
        : salon
          ? 'ready'
          : 'no-salon'

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      salon,
      async signIn(email, password) {
        if (!neon) return 'Neon não configurado.'
        const { error } = await neon.auth.signInWithPassword({ email: email.trim(), password })
        // mensagem genérica: não revela se o e-mail existe
        return error ? 'E-mail ou senha incorretos.' : null
      },
      async signUp(email, password) {
        if (!neon) return { error: 'Neon não configurado.', needsConfirmation: false }
        const { data, error } = await neon.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}${dash()}` },
        })
        if (error) return { error: 'Não foi possível criar a conta. Confira os dados e tente novamente.', needsConfirmation: false }
        return { error: null, needsConfirmation: !data.session }
      },
      async sendPasswordReset(email) {
        if (!neon) return 'Neon não configurado.'
        // ignora o erro de propósito: não revelar se o e-mail está cadastrado
        await neon.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}${ROUTES.reset}` })
        return null
      },
      async updatePassword(password, token) {
        if (!neon) return 'Neon não configurado.'
        const { error } = await neon.auth.getBetterAuthInstance().resetPassword({ newPassword: password, token })
        return error ? 'Não foi possível atualizar a senha. Peça um novo link e tente de novo.' : null
      },
      async signInWithGoogle() {
        if (!neon) return 'Neon não configurado.'
        const { error } = await neon.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}${dash()}` },
        })
        return error ? 'Não foi possível entrar com o Google agora. Tente novamente.' : null
      },
      async signOut() {
        await neon?.auth.signOut()
        setSalon(null)
      },
      async createSalon(name, slug, setup) {
        if (!neon || !userId) return 'Você precisa estar logada.'
        const { data: salonId, error } = await neon.rpc('create_salon', { p_name: name, p_slug: slug })
        if (error) {
          if (error.message.includes('salons_slug_key') || error.code === '23505') {
            return error.message.includes('já pertence') ? 'Esta conta já tem um salão.' : 'Este endereço já está em uso. Escolha outro.'
          }
          if (error.message.includes('salons_slug_not_reserved')) return 'Esse endereço é reservado. Escolha outro.'
          if (error.code === '23514') return 'Use de 3 a 40 letras minúsculas, números e hífen.'
          return 'Não foi possível criar o salão agora. Tente novamente.'
        }
        // monta o que o questionário coletou; se falhar, o negócio já existe e a pessoa completa no painel
        if (setup && typeof salonId === 'string') {
          if (setup.services.length > 0) {
            await neon.from('services').insert(setup.services.map((s) => ({ ...s, salon_id: salonId })))
          }
          if (setup.professionalName) {
            await neon.from('professionals').insert({ salon_id: salonId, user_id: userId, name: setup.professionalName })
          }
        }
        await loadSalon(userId)
        return null
      },
    }),
    [status, session, salon, userId, loadSalon],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

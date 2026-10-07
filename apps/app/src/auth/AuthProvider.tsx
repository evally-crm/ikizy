import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { dash, ROUTES } from '../lib/routes'

export type MemberRole = 'owner' | 'manager' | 'reception' | 'professional'

export interface Salon {
  id: string
  name: string
  slug: string
  role: MemberRole
}

/** demo: sem Supabase configurado · loading: resolvendo sessão/salão */
export type AuthStatus = 'demo' | 'loading' | 'signed-out' | 'no-salon' | 'ready'

interface AuthState {
  status: AuthStatus
  session: Session | null
  salon: Salon | null
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  /** envia o e-mail de recuperação; a resposta é sempre a mesma para não revelar se o e-mail existe */
  sendPasswordReset: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  signOut: () => Promise<void>
  createSalon: (name: string, slug: string) => Promise<string | null>
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
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured)
  const [salonReady, setSalonReady] = useState(!isSupabaseConfigured)

  // sessão
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionReady(true)
    })
    // o callback só atualiza estado: chamar o Supabase aqui dentro pode travar o cliente
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const loadSalon = useCallback(async (uid: string) => {
    if (!supabase) return
    const { data, error } = await supabase
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
    if (!isSupabaseConfigured || !sessionReady) return
    if (!userId) {
      setSalon(null)
      setSalonReady(true)
      return
    }
    setSalonReady(false)
    void loadSalon(userId)
  }, [userId, sessionReady, loadSalon])

  const status: AuthStatus = !isSupabaseConfigured
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
        if (!supabase) return 'Supabase não configurado.'
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        // mensagem genérica: não revela se o e-mail existe
        return error ? 'E-mail ou senha incorretos.' : null
      },
      async signUp(email, password) {
        if (!supabase) return { error: 'Supabase não configurado.', needsConfirmation: false }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}${dash()}` },
        })
        if (error) return { error: 'Não foi possível criar a conta. Confira os dados e tente novamente.', needsConfirmation: false }
        return { error: null, needsConfirmation: !data.session }
      },
      async sendPasswordReset(email) {
        if (!supabase) return 'Supabase não configurado.'
        // ignora o erro de propósito: não revelar se o e-mail está cadastrado
        await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}${ROUTES.reset}` })
        return null
      },
      async updatePassword(password) {
        if (!supabase) return 'Supabase não configurado.'
        const { error } = await supabase.auth.updateUser({ password })
        return error ? 'Não foi possível atualizar a senha. Peça um novo link e tente de novo.' : null
      },
      async signOut() {
        await supabase?.auth.signOut()
        setSalon(null)
      },
      async createSalon(name, slug) {
        if (!supabase || !userId) return 'Você precisa estar logada.'
        const { error } = await supabase.rpc('create_salon', { p_name: name, p_slug: slug })
        if (error) {
          if (error.message.includes('salons_slug_key') || error.code === '23505') {
            return error.message.includes('já pertence') ? 'Esta conta já tem um salão.' : 'Este endereço já está em uso. Escolha outro.'
          }
          if (error.message.includes('salons_slug_not_reserved')) return 'Esse endereço é reservado. Escolha outro.'
          if (error.code === '23514') return 'Use de 3 a 40 letras minúsculas, números e hífen.'
          return 'Não foi possível criar o salão agora. Tente novamente.'
        }
        await loadSalon(userId)
        return null
      },
    }),
    [status, session, salon, userId, loadSalon],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

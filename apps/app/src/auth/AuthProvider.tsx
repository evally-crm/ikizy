import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isNeonConfigured, neon, type NeonSession as Session } from '../lib/neon'
import { dash, ROUTES } from '../lib/routes'
import { STARTER_HOURS, type SalonSetup } from '../lib/segments'

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
  /** `unverified`: senha certa, mas o e-mail ainda não foi confirmado (o Neon Auth já mandou um código) */
  signIn: (email: string, password: string) => Promise<{ error: string | null; unverified: boolean }>
  /** `needsConfirmation`: conta criada, falta confirmar o e-mail com o código que chegou */
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  /** confere o código de 6 dígitos do e-mail; com o código certo a sessão já abre */
  verifyEmailCode: (email: string, code: string) => Promise<{ error: string | null; signedIn: boolean }>
  /** manda um novo código de confirmação para o e-mail */
  resendVerificationCode: (email: string) => Promise<string | null>
  /** envia o e-mail de recuperação; a resposta é sempre a mesma para não revelar se o e-mail existe */
  sendPasswordReset: (email: string) => Promise<string | null>
  /** token vem do link do e-mail (?token=...); o Neon Auth não abre sessão no link de recuperação */
  updatePassword: (password: string, token: string) => Promise<string | null>
  /** abre o login do Google; ao voltar, a sessão é restaurada e o dashboard decide entre salão ou onboarding */
  signInWithGoogle: (next?: string) => Promise<string | null>
  signOut: () => Promise<void>
  /** cria o negócio e já monta o começo: a dona como profissional, serviços sem preço, horário padrão e o plano do teste */
  createSalon: (name: string, slug: string, setup?: SalonSetup) => Promise<string | null>
  /** nome de exibição de quem está logada (cadastro > e-mail > padrão) */
  displayName: string
  /** edita o cadastro: nome da pessoa e nome do negócio (só dono/gerente altera o negócio) */
  updateProfile: (userName: string, salonName: string) => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

type AuthCallError = { message?: string; status?: number; code?: string }

/**
 * chamadas diretas ao Better Auth (getBetterAuthInstance): o cliente do Neon LANÇA o erro quando o servidor
 * responde com falha, em vez de devolver { error }. Aqui as duas formas viram um erro só (ou null).
 */
async function authCall(run: () => Promise<{ error?: AuthCallError | null } | unknown>): Promise<AuthCallError | null> {
  try {
    const result = (await run()) as { error?: AuthCallError | null } | null
    return result?.error ?? null
  } catch (e) {
    return (e as AuthCallError) ?? { message: 'erro' }
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [salon, setSalon] = useState<Salon | null>(null)
  const [sessionReady, setSessionReady] = useState(!isNeonConfigured)
  // id da pessoa cujo salão já foi buscado: sessão nova com busca pendente conta como 'loading', não como 'no-salon'
  const [salonFor, setSalonFor] = useState<string | null>(null)
  // sobrescreve o que veio da sessão/salão logo após editar (e serve de armazenamento no modo demo)
  const [profile, setProfile] = useState<{ userName?: string; salonName?: string }>({})

  // sessão
  useEffect(() => {
    if (!neon) return
    neon.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      // sem conexão com o login: segue como "sem sessão" (vai para o login) em vez de ficar carregando para sempre
      .catch(() => setSession(null))
      .finally(() => setSessionReady(true))
    // o callback só atualiza estado: chamar o cliente aqui dentro pode travar.
    // ele só dispara por mudanças vindas de OUTRAS abas (evento storage); nesta aba, entrar/sair atualiza a sessão direto
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
    setSalonFor(uid)
  }, [])

  // salão do usuário logado
  useEffect(() => {
    if (!isNeonConfigured || !sessionReady) return
    if (!userId) {
      setSalon(null)
      setSalonFor(null)
      return
    }
    void loadSalon(userId)
  }, [userId, sessionReady, loadSalon])

  const status: AuthStatus = !isNeonConfigured
    ? 'demo'
    : !sessionReady || (userId && salonFor !== userId)
      ? 'loading'
      : !session
        ? 'signed-out'
        : salon
          ? 'ready'
          : 'no-salon'

  // o Neon Auth entrega o nome da pessoa em user_metadata.displayName (não em user.name)
  const metaName = session?.user.user_metadata?.displayName
  const sessionName = typeof metaName === 'string' ? metaName.trim() : undefined
  const displayName = profile.userName ?? (sessionName || session?.user.email?.split('@')[0] || 'Maria Eduarda')
  const shownSalon = salon && profile.salonName ? { ...salon, name: profile.salonName } : salon

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      salon: shownSalon,
      displayName,
      async updateProfile(userName, salonName) {
        const person = userName.trim()
        const business = salonName.trim()
        if (person.length < 2) return 'Informe seu nome.'
        if (business.length < 2) return 'O nome do negócio precisa ter pelo menos 2 caracteres.'
        if (neon && salon) {
          if (person !== displayName) {
            // direto no Better Auth: o updateUser do adaptador Supabase lê o { status: true } de sucesso como falha
            const error = await authCall(() => neon!.auth.getBetterAuthInstance().updateUser({ name: person }))
            if (error) return 'Não foi possível salvar seu nome agora. Tente novamente.'          }
          if (business !== salon.name) {
            const { data, error } = await neon.from('salons').update({ name: business }).eq('id', salon.id).select('id')
            if (error || !data?.length) return 'Só quem é dona ou gerente pode alterar o nome do negócio.'
          }
        }
        setProfile({ userName: person, salonName: business })
        return null
      },
      async signIn(email, password) {
        if (!neon) return { error: 'Neon não configurado.', unverified: false }
        const { data, error } = await neon.auth.signInWithPassword({ email: email.trim(), password })
        // só chega aqui com a senha certa: o Neon Auth confere a senha antes de recusar o e-mail não confirmado
        if (error?.code === 'email_not_confirmed') return { error: null, unverified: true }
        // mensagem genérica: não revela se o e-mail existe
        if (error) return { error: 'E-mail ou senha incorretos.', unverified: false }
        setSession(data.session)
        return { error: null, unverified: false }
      },
      async signUp(email, password, name) {
        if (!neon) return { error: 'Neon não configurado.', needsConfirmation: false }
        const { data, error } = await neon.auth.signUp({
          email: email.trim(),
          password,
          // o adaptador grava `displayName` como o nome da conta
          options: { emailRedirectTo: `${window.location.origin}${dash()}`, data: { displayName: name.trim() } },
        })
        if (error) {
          // com a confirmação de e-mail ligada, o Neon Auth cria a conta sem abrir sessão e o adaptador
          // devolve 'session_not_found': a conta existe, falta só o código que já foi enviado
          if (error.code === 'session_not_found') return { error: null, needsConfirmation: true }
          // e-mail já cadastrado (ex.: conta criada antes de terminar o questionário): com a senha certa, só entra e segue
          const exists = error.code === 'user_already_exists' || error.code === 'email_exists' || /already exists/i.test(error.message)
          if (exists) {
            const { data: signedIn, error: signInError } = await neon.auth.signInWithPassword({ email: email.trim(), password })
            if (!signInError) {
              setSession(signedIn.session)
              return { error: null, needsConfirmation: false }
            }
            // senha certa, mas o e-mail ainda não foi confirmado: segue para a tela do código
            if (signInError.code === 'email_not_confirmed') return { error: null, needsConfirmation: true }
            return { error: 'Este e-mail já tem conta. Entre com a sua senha ou use "Esqueci a senha".', needsConfirmation: false }
          }
          return { error: 'Não foi possível criar a conta. Confira os dados e tente novamente.', needsConfirmation: false }
        }
        if (data.session) setSession(data.session)
        return { error: null, needsConfirmation: !data.session }
      },
      async verifyEmailCode(email, code) {
        if (!neon) return { error: 'Neon não configurado.', signedIn: false }
        const auth = neon.auth.getBetterAuthInstance()
        const error = await authCall(() => auth.emailOtp.verifyEmail({ email: email.trim(), otp: code.trim() }))
        if (error) {
          const expired = /expired/i.test(error.message ?? '')
          return { error: expired ? 'Esse código expirou. Peça um novo.' : 'Código incorreto. Confira o e-mail e tente de novo.', signedIn: false }
        }
        // com "entrar depois de confirmar" ligado no Neon Auth, a sessão já está aberta
        const { data } = await neon.auth.getSession()
        if (data.session) setSession(data.session)
        return { error: null, signedIn: Boolean(data.session) }
      },
      async resendVerificationCode(email) {
        if (!neon) return 'Neon não configurado.'
        const auth = neon.auth.getBetterAuthInstance()
        const error = await authCall(() => auth.emailOtp.sendVerificationOtp({ email: email.trim(), type: 'email-verification' }))
        if (!error) return null
        return error.status === 429 ? 'Muitos pedidos seguidos. Espere um pouco e tente de novo.' : 'Não foi possível enviar o código agora. Tente novamente.'
      },
      async sendPasswordReset(email) {
        if (!neon) return 'Neon não configurado.'
        // ignora o erro de propósito: não revelar se o e-mail está cadastrado
        await neon.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}${ROUTES.reset}` })
        return null
      },
      async updatePassword(password, token) {
        if (!neon) return 'Neon não configurado.'
        const error = await authCall(() => neon!.auth.getBetterAuthInstance().resetPassword({ newPassword: password, token }))
        return error ? 'Não foi possível atualizar a senha. Peça um novo link e tente de novo.' : null
      },
      async signInWithGoogle(next) {
        if (!neon) return 'Neon não configurado.'
        // só caminhos do próprio sistema (nunca um endereço de fora vindo da URL)
        const back = next && next.startsWith('/dashboard') ? next : dash()
        const { error } = await neon.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}${back}` },
        })
        return error ? 'Não foi possível entrar com o Google agora. Tente novamente.' : null
      },
      async signOut() {
        // o evento SIGNED_OUT não chega nesta aba (só nas outras); sem limpar a sessão aqui, ela continua em memória
        // e o status vira 'no-salon' (sessão sem salão), mandando para o /cadastro/salao em vez do login
        try {
          await neon?.auth.signOut()
        } catch {
          // falha de rede: sai localmente mesmo assim
        }
        setSession(null)
        setSalon(null)
        setProfile({})
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
        // monta o começo do negócio; se algo falhar, o negócio já existe e os primeiros passos mostram o que falta
        if (setup && typeof salonId === 'string') {
          // conta sem nome (cadastro antigo): o nome digitado aqui vira o nome da conta
          if (!sessionName && setup.professionalName.length >= 2) {
            await authCall(() => neon!.auth.getBetterAuthInstance().updateUser({ name: setup.professionalName }))
            setProfile((p) => ({ ...p, userName: setup.professionalName }))
          }
          if (setup.services.length > 0) {
            await neon.from('services').insert(setup.services.map((s) => ({ ...s, salon_id: salonId })))
          }
          const pro = await neon
            .from('professionals')
            .insert({ salon_id: salonId, user_id: userId, name: setup.professionalName })
            .select('id')
            .single()
          if (!pro.error && pro.data) {
            await neon.rpc('set_working_hours', { p_professional: pro.data.id, p_intervals: STARTER_HOURS })
          }
          // o teste começa sem cartão, no plano que combina com a resposta da equipe
          await neon.rpc('choose_trial_plan', { p_plan: setup.plan })
        }
        await loadSalon(userId)
        return null
      },
    }),
    [status, session, salon, shownSalon, displayName, userId, loadSalon, sessionName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

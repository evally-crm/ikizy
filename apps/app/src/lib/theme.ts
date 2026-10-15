import { useEffect, useSyncExternalStore } from 'react'

/** escolha guardada no aparelho; o index.html lê a mesma chave antes do app carregar, para não piscar claro */
const KEY = 'ikizy:theme'

export type Theme = 'light' | 'dark'

const listeners = new Set<() => void>()

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* sem storage: vale só nesta visita */
  }
  document.documentElement.dataset.theme = theme
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** tema atual e o seletor; quem usa o hook dentro do sistema também aplica o tema na página */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => 'light' as Theme)
  return [theme, setTheme] as const
}

/** liga o tema escolhido enquanto o sistema está aberto; login e cadastro voltam ao claro */
export function useAppTheme() {
  const [theme] = useTheme()
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [theme])
}

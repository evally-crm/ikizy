import { Moon } from 'lucide-react'
import { useTheme } from '../lib/theme'

/** linha "Modo escuro" com a chave à direita (Configurações no celular, menu da conta e tela Minha conta) */
export function DarkModeRow({ className = 'settings__row' }: { className?: string }) {
  const [theme, setTheme] = useTheme()
  const dark = theme === 'dark'
  return (
    <label className={`${className} settings__row--switch`}>
      <Moon size={19} aria-hidden="true" />
      <span>Modo escuro</span>
      <input type="checkbox" role="switch" checked={dark} onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')} />
      <span className="switch__track" aria-hidden="true" />
    </label>
  )
}

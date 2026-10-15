import { Search } from 'lucide-react'
import './SearchField.css'

/** campo de busca em pílula, com lupa */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  /** nome do campo para leitores de tela */
  label: string
  placeholder?: string
}) {
  return (
    <label className="searchfield">
      <Search size={16} aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
    </label>
  )
}

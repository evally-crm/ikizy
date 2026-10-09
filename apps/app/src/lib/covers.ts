/**
 * Fundos prontos para a capa do site (arquivos em public/capas/<id>.jpg e <id>-mini.jpg).
 * A capa fica salva como "capa:<id>"; a página pública e a prévia transformam isso no endereço da imagem.
 * Usado pelo app e pelo servidor (api/_lib/siteHtml.ts): não importa nada do React.
 *
 * Para trocar ou acrescentar fotos: coloque <id>.jpg (1600x1000) e <id>-mini.jpg (480x300) em
 * public/capas/ e adicione o id aqui.
 */
export interface CoverOption {
  id: string
  label: string
}

export const COVERS: CoverOption[] = [
  { id: 'seda-rose', label: 'Seda rosé' },
  { id: 'petala', label: 'Pétala' },
  { id: 'linho-bege', label: 'Linho bege' },
  { id: 'areia', label: 'Areia' },
  { id: 'marmore-claro', label: 'Mármore claro' },
  { id: 'nevoa-azul', label: 'Névoa azul' },
  { id: 'veludo-vinho', label: 'Veludo vinho' },
  { id: 'pinho-creme', label: 'Pinho' },
  { id: 'marmore-preto', label: 'Mármore preto' },
  { id: 'noite', label: 'Noite' },
]

const PREFIX = 'capa:'

export const coverValue = (id: string) => `${PREFIX}${id}`

/** id do fundo pronto, se o valor for um deles (e existir na lista) */
export function coverId(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return null
  const id = value.slice(PREFIX.length)
  return COVERS.some((c) => c.id === id) ? id : null
}

/** endereço da imagem do fundo pronto; `base` é a origem (vazio = caminho relativo ao site) */
export function coverUrl(value: string | null | undefined, base = '', mini = false): string | null {
  const id = coverId(value)
  return id ? `${base}/capas/${id}${mini ? '-mini' : ''}.jpg` : null
}

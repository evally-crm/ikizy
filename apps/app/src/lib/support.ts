/** canal de ajuda do IKIZY (o mesmo e-mail de contato da landing) */
export const SUPPORT_EMAIL = 'contato@ikizy.com'

/** link que abre o e-mail já com o assunto e o contexto (quem pede e o negócio), para a ajuda não começar perguntando */
export function supportHref(who?: { name?: string; email?: string | null; salon?: string | null }): string {
  const lines = ['Olá! Preciso de ajuda com o IKIZY.', '', '(escreva aqui o que está acontecendo)', '', '---']
  if (who?.name) lines.push(`Nome: ${who.name}`)
  if (who?.email) lines.push(`E-mail da conta: ${who.email}`)
  if (who?.salon) lines.push(`Negócio: ${who.salon}`)
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ajuda com o IKIZY')}&body=${encodeURIComponent(lines.join('\n'))}`
}

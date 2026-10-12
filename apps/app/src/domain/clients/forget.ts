/** nome que fica na ficha depois de apagar os dados (a mesma da função forget_client() do banco) */
export const FORGOTTEN_CLIENT_NAME = 'Cliente removida'

/** a ficha já foi anonimizada e não deve aparecer nas listas */
export const isForgotten = (name: string) => name === FORGOTTEN_CLIENT_NAME

/** tira acento, caixa e espaços extras para comparar o que a pessoa digitou com o nome da cliente */
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** apagar dados pede para digitar o nome da cliente (R-75): vale sem acento e sem diferença de maiúsculas */
export const confirmsClientName = (typed: string, name: string) => normalize(name).length > 0 && normalize(typed) === normalize(name)

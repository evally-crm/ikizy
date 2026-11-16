import { renderBrandEmail } from './emailLayout.js'

/** e-mails de depois de apagar uma conta: quem pediu, a equipe que perdeu o acesso e a dona quando foi o master */
export type ClosedKind = 'self' | 'by-admin' | 'member'

const SITE = 'https://ikizy.com'

export function renderClosedEmail(kind: ClosedKind, salonName: string, hasCard: boolean) {
  const paragraphs =
    kind === 'self'
      ? [
          `Excluímos a sua conta e o negócio ${salonName}: clientes, agenda, caixa, fotos e site foram apagados.`,
          hasCard ? 'A assinatura no cartão foi cancelada na hora, sem novas cobranças.' : 'Não há nenhuma cobrança pendente.',
          'Se não foi você quem pediu, fale com a gente pelo site o quanto antes.',
        ]
      : kind === 'by-admin'
        ? [
            `O negócio ${salonName} e a sua conta foram encerrados pela equipe do IKIZY. Os dados foram apagados e a assinatura, cancelada.`,
            'Se isso foi uma surpresa, fale com a gente pelo site.',
          ]
        : [
            `A dona encerrou o negócio ${salonName} no IKIZY, e o seu acesso foi removido.`,
            'A sua conta continua. Você pode criar o seu próprio negócio quando quiser.',
          ]
  const subject = kind === 'member' ? `${salonName} foi encerrado no IKIZY` : 'Sua conta do IKIZY foi excluída'
  const footer =
    kind === 'member'
      ? `Você recebeu este e-mail porque tinha acesso a ${salonName} no IKIZY.`
      : 'Você recebeu este e-mail porque a sua conta do IKIZY foi excluída.'
  const mail = renderBrandEmail({
    title: kind === 'member' ? 'Negócio encerrado' : 'Conta excluída',
    subtitle: kind === 'member' ? 'Seu acesso foi removido.' : 'Está tudo apagado.',
    paragraphs,
    button: 'Ir para o IKIZY',
    link: SITE,
    footer,
  })
  return { subject, ...mail }
}

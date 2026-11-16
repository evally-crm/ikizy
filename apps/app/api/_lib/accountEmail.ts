import { renderBrandEmail } from './emailLayout.js'

/** e-mails do ciclo de vida da conta: pedido de exclusão, aviso de limpeza, e o aviso de depois de apagar */
export type ClosedKind = 'self' | 'by-admin' | 'member' | 'expired'

const SITE = 'https://ikizy.com'

/** "23/11/2026", no fuso de Brasília */
export const dayBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export function renderClosedEmail(kind: ClosedKind, salonName: string, hasCard: boolean) {
  const paragraphs =
    kind === 'self'
      ? [
          `Excluímos a sua conta e o negócio ${salonName}: clientes, agenda, caixa, fotos e site foram apagados.`,
          hasCard ? 'A assinatura no cartão foi cancelada, sem novas cobranças.' : 'Não há nenhuma cobrança pendente.',
          'Se não foi você quem pediu, fale com a gente pelo site o quanto antes.',
        ]
      : kind === 'by-admin'
        ? [
            `O negócio ${salonName} e a sua conta foram encerrados pela equipe do IKIZY. Os dados foram apagados e a assinatura, cancelada.`,
            'Se isso foi uma surpresa, fale com a gente pelo site.',
          ]
        : kind === 'expired'
          ? [
              `O negócio ${salonName} ficou mais de 90 dias sem assinatura, e os dados foram apagados, como avisamos.`,
              'Quando quiser voltar, é só criar um negócio novo no IKIZY.',
            ]
          : [
              `A dona encerrou o negócio ${salonName} no IKIZY, e o seu acesso foi removido.`,
              'A sua conta continua. Você pode criar o seu próprio negócio quando quiser.',
            ]
  const subject = kind === 'member' ? `${salonName} foi encerrado no IKIZY` : kind === 'expired' ? `${salonName} foi apagado do IKIZY` : 'Sua conta do IKIZY foi excluída'
  const footer =
    kind === 'member'
      ? `Você recebeu este e-mail porque tinha acesso a ${salonName} no IKIZY.`
      : 'Você recebeu este e-mail porque tinha uma conta no IKIZY.'
  const mail = renderBrandEmail({
    title: kind === 'member' ? 'Negócio encerrado' : kind === 'expired' ? 'Dados apagados' : 'Conta excluída',
    subtitle: kind === 'member' ? 'Seu acesso foi removido.' : 'Está tudo apagado.',
    paragraphs,
    button: 'Ir para o IKIZY',
    link: SITE,
    footer,
  })
  return { subject, ...mail }
}

/** a dona pediu para excluir: tem até a data para desistir */
export function renderScheduledEmail(salonName: string, on: Date, link: string) {
  const mail = renderBrandEmail({
    title: 'Exclusão agendada',
    subtitle: `Acontece em ${dayBR(on)}.`,
    paragraphs: [
      `Recebemos o pedido para excluir a conta e o negócio ${salonName}. Em ${dayBR(on)} vamos apagar tudo: clientes, agenda, caixa, fotos e site.`,
      'Até lá você pode desistir: entre no IKIZY e toque em "Cancelar exclusão". Se não foi você quem pediu, cancele agora e troque a sua senha.',
    ],
    button: 'Cancelar a exclusão',
    link,
    footer: 'Você recebeu este e-mail porque alguém pediu a exclusão da sua conta do IKIZY.',
  })
  return { subject: `Exclusão da sua conta agendada para ${dayBR(on)}`, ...mail }
}

/** 7 dias antes de apagar um negócio sem assinatura há mais de 90 dias (R-107) */
export function renderRetentionWarnEmail(salonName: string, on: Date, link: string) {
  const mail = renderBrandEmail({
    title: 'Seus dados serão apagados',
    subtitle: `Em ${dayBR(on)}.`,
    paragraphs: [
      `O acesso de ${salonName} ao IKIZY terminou há mais de 80 dias. Para proteger os dados das suas clientes, vamos apagar tudo em ${dayBR(on)}.`,
      'Para manter clientes, agenda e site, escolha um plano antes dessa data.',
    ],
    button: 'Escolher um plano',
    link,
    footer: `Você recebeu este e-mail porque ${salonName} tem uma conta no IKIZY.`,
  })
  return { subject: `${salonName}: seus dados serão apagados em ${dayBR(on)}`, ...mail }
}

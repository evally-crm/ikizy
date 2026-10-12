import { PAYMENT_LABEL } from '../../types'
import type { MethodKey } from './types'

/** taxa média cobrada pela maquininha nos pagamentos em crédito e débito (estimativa) */
export const CARD_FEE_PCT = 3.1

/** quantos pontos tem a grade da composição: cada ponto vale 2% do faturamento */
export const WAFFLE_DOTS = 50

/** ordem das formas de pagamento no caixa */
export const METHOD_ORDER: MethodKey[] = ['pix', 'credito', 'debito', 'dinheiro', 'nao']

export const methodLabel = (m: MethodKey) => (m === 'nao' ? 'Não informado' : PAYMENT_LABEL[m])

/** arredonda para centavos */
export const cents = (value: number) => Math.round(value * 100) / 100

/** valor da taxa de cartão sobre o total recebido em crédito e débito */
export const cardFeeOf = (cardTotal: number) => cents(cardTotal * (CARD_FEE_PCT / 100))

/** o percentual da taxa, no formato que aparece na tela: "3,1" */
export const cardFeeLabel = () => CARD_FEE_PCT.toString().replace('.', ',')

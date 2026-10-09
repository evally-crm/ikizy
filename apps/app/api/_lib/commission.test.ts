import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  commissionFor,
  commissionsByProfessional,
  describeRule,
  findRule,
  planHasCommission,
  ruleProblem,
  type CommissionRule,
  type CommissionSettings,
} from '../../src/lib/commission.js'

const ON: CommissionSettings = { enabled: true, base: 'price' }
const rules: CommissionRule[] = [
  { professionalId: null, serviceId: null, kind: 'percent', value: 30 }, // padrão do salão
  { professionalId: 'ana', serviceId: null, kind: 'percent', value: 40 }, // Ana ganha mais
  { professionalId: null, serviceId: 'mechas', kind: 'percent', value: 50 }, // mechas paga 50% para todas
  { professionalId: 'ana', serviceId: 'mechas', kind: 'fixed', value: 120 }, // Ana nas mechas: R$ 120
]

describe('comissão', () => {
  it('escolhe a regra mais específica', () => {
    assert.equal(findRule(rules, 'ana', 'mechas')?.value, 120)
    assert.equal(findRule(rules, 'bia', 'mechas')?.value, 50)
    assert.equal(findRule(rules, 'ana', 'corte')?.value, 40)
    assert.equal(findRule(rules, 'bia', 'corte')?.value, 30)
    assert.equal(findRule(rules, 'bia', null)?.value, 30)
    assert.equal(findRule([], 'bia', 'corte'), null)
  })

  it('calcula % e valor fixo', () => {
    assert.equal(commissionFor({ professionalId: 'bia', serviceId: 'corte', price: 100 }, rules, ON, 3.1), 30)
    assert.equal(commissionFor({ professionalId: 'ana', serviceId: 'corte', price: 100 }, rules, ON, 3.1), 40)
    assert.equal(commissionFor({ professionalId: 'ana', serviceId: 'mechas', price: 400 }, rules, ON, 3.1), 120)
    assert.equal(commissionFor({ professionalId: 'bia', serviceId: 'mechas', price: 400 }, rules, ON, 3.1), 200)
  })

  it('desligada ou sem regra: zero', () => {
    assert.equal(commissionFor({ professionalId: 'ana', serviceId: 'corte', price: 100 }, rules, { ...ON, enabled: false }, 3.1), 0)
    assert.equal(commissionFor({ professionalId: 'ana', serviceId: 'corte', price: 100 }, [], ON, 3.1), 0)
  })

  it('base sem a taxa do cartão só desconta em crédito e débito', () => {
    const base: CommissionSettings = { enabled: true, base: 'price_minus_card_fee' }
    const r: CommissionRule[] = [{ professionalId: null, serviceId: null, kind: 'percent', value: 50 }]
    assert.equal(commissionFor({ professionalId: 'x', serviceId: null, price: 100, paymentMethod: 'credito' }, r, base, 3.1), 48.45)
    assert.equal(commissionFor({ professionalId: 'x', serviceId: null, price: 100, paymentMethod: 'pix' }, r, base, 3.1), 50)
    // valor fixo não muda com a taxa
    assert.equal(commissionFor({ professionalId: 'x', serviceId: null, price: 100, paymentMethod: 'credito' }, [{ ...r[0], kind: 'fixed', value: 20 }], base, 3.1), 20)
  })

  it('soma por profissional, em centavos', () => {
    const lines = commissionsByProfessional(
      [
        { professionalId: 'ana', serviceId: 'corte', price: 33.33 },
        { professionalId: 'ana', serviceId: 'corte', price: 33.33 },
        { professionalId: 'bia', serviceId: 'corte', price: 50 },
      ],
      rules,
      ON,
      3.1,
    )
    assert.deepEqual(lines, [
      { professionalId: 'ana', qty: 2, total: 26.66 },
      { professionalId: 'bia', qty: 1, total: 15 },
    ])
    assert.deepEqual(commissionsByProfessional([{ professionalId: 'ana', serviceId: null, price: 10 }], rules, { ...ON, enabled: false }, 3.1), [])
  })

  it('não existe no Solo', () => {
    assert.equal(planHasCommission('solo'), false)
    assert.equal(planHasCommission('studio'), true)
    assert.equal(planHasCommission('salao'), true)
    assert.equal(planHasCommission(undefined), false)
  })

  it('descreve e valida regras', () => {
    assert.equal(describeRule({ kind: 'percent', value: 12.5 }), '12,5%')
    assert.match(describeRule({ kind: 'fixed', value: 15 }), /15,00 por atendimento/)
    assert.equal(ruleProblem({ kind: 'percent', value: 101 }), 'A porcentagem vai até 100%.')
    assert.equal(ruleProblem({ kind: 'fixed', value: -1 }), 'Use um valor positivo.')
    assert.equal(ruleProblem({ kind: 'fixed', value: 30 }), null)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_DAYS, hoursForDb, matchingPreset, timeOptions, toggleDay } from './hours'
import { planFit, suggestedPlan } from './plan'
import { previewWeek } from './preview'
import { addService, removeService, reviewGroups, serviceCount, starterFromGroups, type ServiceChange } from './services'
import { neighbors, reachableStep, slugProblem, stepProblem, stepsFor, type OnboardingAnswers } from './steps'

const answers = (over: Partial<OnboardingAnswers> = {}): OnboardingAnswers => ({
  ownerName: 'Maria',
  name: 'Studio Maria',
  slug: 'studio-maria',
  slugTaken: false,
  segments: ['unhas'],
  otherLabel: '',
  team: 'solo',
  days: DEFAULT_DAYS,
  start: 540,
  end: 1140,
  serviceCount: 4,
  ...over,
})

describe('perguntas do cadastro', () => {
  it('só pergunta o nome da pessoa quando a conta veio sem nome', () => {
    assert.deepEqual(stepsFor(false), ['nome', 'areas', 'equipe', 'horario', 'servicos'])
    assert.equal(stepsFor(true)[0], 'voce')
  })

  it('anda para a próxima e volta para a anterior', () => {
    const steps = stepsFor(false)
    assert.deepEqual(neighbors(steps, 'nome'), { prev: null, next: 'areas' })
    assert.deepEqual(neighbors(steps, 'servicos'), { prev: 'horario', next: null })
  })

  it('o link precisa de 3 letras, não pode ser reservado nem de outro negócio', () => {
    assert.match(slugProblem('ab', false, false)!, /3 letras/)
    assert.match(slugProblem('app', true, false)!, /reservado/)
    assert.match(slugProblem('maria', false, true)!, /em uso/)
    assert.equal(slugProblem('maria', false, false), null)
  })

  it('cada pergunta diz o que falta', () => {
    assert.match(stepProblem('nome', answers({ name: 'A' }), false)!, /nome/)
    assert.match(stepProblem('areas', answers({ segments: [] }), false)!, /área/)
    assert.match(stepProblem('areas', answers({ segments: ['outro'], otherLabel: '' }), false)!, /outra área/)
    assert.match(stepProblem('equipe', answers({ team: null }), false)!, /opções/)
    assert.match(stepProblem('horario', answers({ days: [] }), false)!, /dia/)
    assert.match(stepProblem('horario', answers({ start: 600, end: 600 }), false)!, /depois/)
    assert.match(stepProblem('servicos', answers({ serviceCount: 0 }), false)!, /pelo menos um/)
    assert.equal(stepProblem('servicos', answers(), false), null)
  })

  it('quem abre uma pergunta adiante pelo endereço volta para a primeira sem resposta', () => {
    const steps = stepsFor(false)
    assert.equal(reachableStep(steps, 'horario', answers({ team: null }), false), 'equipe')
    assert.equal(reachableStep(steps, 'horario', answers(), false), 'horario')
    // a própria pergunta pode estar sem resposta: é nela que a pessoa responde
    assert.equal(reachableStep(steps, 'equipe', answers({ team: null }), false), 'equipe')
    assert.equal(reachableStep(steps, 'voce', answers(), false), 'nome')
  })
})

describe('serviços do cadastro', () => {
  it('cada área começa com os 4 serviços mais comuns, sem preço', () => {
    const groups = reviewGroups(['unhas', 'cilios'], '', [], [])
    assert.deepEqual(groups.map((g) => g.label), ['Unhas', 'Cílios'])
    assert.equal(groups[0].services.length, 4)
    const db = starterFromGroups(groups)
    assert.ok(db.every((s) => s.price === 0))
    assert.equal(db[0].category, 'Unhas')
  })

  it('"Outro" usa o nome que a pessoa digitou e começa vazio', () => {
    const [g] = reviewGroups(['outro'], 'Maquiagem', [], [])
    assert.equal(g.label, 'Maquiagem')
    assert.equal(g.services.length, 0)
  })

  it('tira e põe serviços; o digitado entra com 60 minutos na categoria da área', () => {
    let removed: ServiceChange[] = []
    let added: ServiceChange[] = []
    ;({ removed, added } = removeService(removed, added, { segment: 'unhas', name: 'Mão e pé' }))
    let groups = reviewGroups(['unhas'], '', removed, added)
    assert.ok(!groups[0].services.some((s) => s.name === 'Mão e pé'))

    const ok = addService(groups, removed, added, { segment: 'unhas', name: '  Spa   dos pés ' })
    assert.ok(!('error' in ok))
    ;({ removed, added } = ok)
    groups = reviewGroups(['unhas'], '', removed, added)
    const spa = groups[0].services.find((s) => s.name === 'Spa dos pés')
    assert.equal(spa?.duration, 60)
    assert.equal(starterFromGroups(groups).find((s) => s.name === 'Spa dos pés')?.category, 'Unhas')

    // tirar um digitado só o esquece
    ;({ removed, added } = removeService(removed, added, { segment: 'unhas', name: 'spa dos pes' }))
    assert.equal(added.length, 0)
  })

  it('pôr de volta um serviço comum desfaz a remoção, e repetido não entra', () => {
    const removed = [{ segment: 'unhas', name: 'Mão e pé' }]
    const groups = reviewGroups(['unhas'], '', removed, [])
    const back = addService(groups, removed, [], { segment: 'unhas', name: 'mao e pe' })
    assert.ok(!('error' in back) && back.removed.length === 0 && back.added.length === 0)
    const dup = addService(reviewGroups(['unhas'], '', [], []), [], [], { segment: 'unhas', name: 'MÃO E PÉ' })
    assert.ok('error' in dup && /já está/.test(dup.error))
    assert.ok('error' in addService(groups, [], [], { segment: 'unhas', name: 'x' }))
  })

  it('áreas desmarcadas levam junto os serviços delas', () => {
    const added = [{ segment: 'cilios', name: 'Tintura' }]
    assert.equal(serviceCount(reviewGroups(['unhas'], '', [], added)), 4)
  })
})

describe('horário do cadastro', () => {
  it('liga e desliga dias mantendo a semana de segunda a domingo', () => {
    assert.deepEqual(toggleDay([1, 2], 0), [1, 2, 0])
    assert.deepEqual(toggleDay([1, 2, 0], 1), [2, 0])
  })

  it('reconhece o atalho marcado e grava um intervalo por dia', () => {
    assert.equal(matchingPreset([6, 5, 4, 3, 2, 1], 540, 1140), 'seg-sab')
    assert.equal(matchingPreset([1, 2], 540, 1140), null)
    assert.deepEqual(hoursForDb([1], 540, 600), [{ weekday: 1, start_minute: 540, end_minute: 600 }])
  })

  it('oferece horários de meia em meia hora', () => {
    const t = timeOptions()
    assert.equal(t[0], 360)
    assert.equal(t[1] - t[0], 30)
    assert.equal(t.at(-1), 23 * 60)
  })
})

describe('plano no fim do cadastro', () => {
  it('sugere Solo para quem atende sozinha e Studio para quem tem equipe; o plano do site vale mais', () => {
    assert.equal(suggestedPlan('solo', null), 'solo')
    assert.equal(suggestedPlan('equipe', null), 'studio')
    assert.equal(suggestedPlan('solo', 'salao'), 'salao')
    assert.equal(suggestedPlan(null, 'qualquer'), 'solo')
  })

  it('avisa quando a equipe não cabe no Solo', () => {
    assert.equal(planFit('solo', 'equipe')?.fits, false)
    assert.equal(planFit('studio', 'equipe')?.fits, true)
    assert.equal(planFit('salao', 'solo')?.fits, true)
    assert.equal(planFit('solo', null), null)
  })
})

describe('prévia da agenda no fundo', () => {
  const services = [{ name: 'Manicure', duration: 45 }]

  it('abre só os dias marcados, dentro da grade', () => {
    const week = previewWeek([1, 2], 540, 1140, services, false)
    assert.equal(week.days.length, 7)
    assert.deepEqual(week.days.filter((d) => d.open).map((d) => d.weekday), [1, 2])
    const mon = week.days[0]
    assert.ok(mon.openTop > 0 && mon.openTop + mon.openHeight < 100)
    assert.ok(week.days.every((d) => d.blocks.length === 0))
  })

  it('preenchida, ganha atendimentos de exemplo com os serviços da pessoa, sem passar do fechamento', () => {
    const week = previewWeek([1, 2, 3], 540, 1140, services, true)
    const blocks = week.days.flatMap((d) => d.blocks)
    assert.ok(blocks.length >= 6)
    assert.ok(blocks.every((b) => b.name === 'Manicure' && b.top + b.height <= 100))
  })

  it('sem horário válido usa a grade padrão e nenhum dia aberto', () => {
    const week = previewWeek([], 540, 1140, services, true)
    assert.ok(week.days.every((d) => !d.open && d.blocks.length === 0))
    assert.equal(week.hours[0], 480)
  })
})

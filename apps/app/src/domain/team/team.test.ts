import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fitsPlan } from '../../lib/plans'
import { monthEarnings, type EarningAppointment } from './earnings'
import { expiresLabel, inviteMessage, inviteStateText, isInviteToken } from './invite'
import { limitMessage, planForTeam, teamUsage, usageLabel } from './limits'
import { assignableRoles, canManageMember, invitableRoles, roleAccess } from './roles'
import { membersWithoutAgenda, professionalAccess } from './status'

describe('perfis', () => {
  it('a profissional vê só a agenda dela e os ganhos, sem financeiro, site, negócio, equipe ou assinatura', () => {
    const a = roleAccess('professional')
    assert.equal(a.agendaAll, false)
    assert.equal(a.finance, 'none')
    assert.equal(a.earnings, true)
    assert.deepEqual([a.site, a.business, a.team, a.billing, a.clientValues], [false, false, false, false, false])
  })
  it('a recepção vê a agenda de todas e só o caixa de hoje', () => {
    const a = roleAccess('reception')
    assert.equal(a.agendaAll, true)
    assert.equal(a.finance, 'today')
    assert.equal(a.clientValues, false)
    assert.equal(a.team, false)
  })
  it('a gerente vê tudo menos a assinatura', () => {
    const a = roleAccess('manager')
    assert.equal(a.finance, 'full')
    assert.equal(a.team, true)
    assert.equal(a.billing, false)
  })
  it('só a dona vê a assinatura', () => {
    assert.equal(roleAccess('owner').billing, true)
  })
})

describe('quem convida quem (R-24)', () => {
  it('no Solo ninguém convida', () => {
    assert.deepEqual(invitableRoles('owner', 'solo'), [])
  })
  it('no Studio só se convida profissional', () => {
    assert.deepEqual(invitableRoles('owner', 'studio'), ['professional'])
  })
  it('no Salão a dona convida os três perfis e a gerente não convida gerente', () => {
    assert.deepEqual(invitableRoles('owner', 'salao'), ['professional', 'reception', 'manager'])
    assert.deepEqual(invitableRoles('manager', 'salao'), ['professional', 'reception'])
  })
  it('recepção e profissional não convidam', () => {
    assert.deepEqual(invitableRoles('reception', 'salao'), [])
    assert.deepEqual(invitableRoles('professional', 'salao'), [])
  })
  it('ninguém mexe na dona nem no próprio acesso; gerente não mexe em gerente', () => {
    assert.equal(canManageMember('owner', 'owner', false), false)
    assert.equal(canManageMember('owner', 'manager', true), false)
    assert.equal(canManageMember('owner', 'manager', false), true)
    assert.equal(canManageMember('manager', 'manager', false), false)
    assert.equal(canManageMember('manager', 'professional', false), true)
    assert.equal(canManageMember('reception', 'professional', false), false)
  })
})

describe('limites por plano (R-26)', () => {
  it('Studio: 3 profissionais e 3 acessos, contando convites em aberto', () => {
    const u = teamUsage('studio', { activeProfessionals: 3, members: 2, openInvites: 1 })
    assert.equal(u.professionals.full, true)
    assert.equal(u.access.full, true)
    assert.equal(usageLabel(u.access), '3 de 3')
  })
  it('Salão não tem limite', () => {
    const u = teamUsage('salao', { activeProfessionals: 12, members: 9, openInvites: 2 })
    assert.equal(u.professionals.full, false)
    assert.equal(usageLabel(u.professionals), '12')
  })
  it('Solo: a dona já ocupa a única vaga', () => {
    const u = teamUsage('solo', { activeProfessionals: 1, members: 1, openInvites: 0 })
    assert.equal(u.professionals.full, true)
    assert.equal(u.access.full, true)
  })
  it('sugere o menor plano em que a equipe cabe', () => {
    assert.equal(planForTeam(1, 1), 'solo')
    assert.equal(planForTeam(3, 2), 'studio')
    assert.equal(planForTeam(4, 2), 'salao')
  })
  it('trocar para um plano menor exige caber nele (R-106)', () => {
    assert.equal(fitsPlan('solo', { professionals: 2, members: 1 }), false)
    assert.equal(fitsPlan('studio', { professionals: 3, members: 3 }), true)
    assert.equal(fitsPlan('studio', { professionals: 3, members: 4 }), false)
  })
  it('a mensagem de limite diz qual plano libera mais', () => {
    assert.match(limitMessage('studio', 'professionals'), /Salão/)
    assert.match(limitMessage('solo', 'access'), /Studio/)
  })
})

describe('convite', () => {
  it('só aceita token no formato do banco', () => {
    assert.equal(isInviteToken('a'.repeat(64)), true)
    assert.equal(isInviteToken('A'.repeat(64)), false)
    assert.equal(isInviteToken('../dashboard'), false)
  })
  it('explica por que não vale mais', () => {
    assert.equal(inviteStateText('ok'), null)
    assert.match(inviteStateText('expired') ?? '', /7 dias/)
  })
  it('conta os dias até vencer', () => {
    const now = new Date(2026, 9, 15, 10)
    assert.equal(expiresLabel(new Date(2026, 9, 22, 10), now), 'vence em 7 dias')
    assert.equal(expiresLabel(new Date(2026, 9, 15, 20), now), 'vence em até 1 dia')
    assert.equal(expiresLabel(new Date(2026, 9, 14), now), 'vencido')
  })
  it('a mensagem leva o primeiro nome, o negócio e o link', () => {
    const msg = inviteMessage({ salonName: 'Studio Bia', role: 'professional', name: 'Carla Souza', url: 'https://app.ikizy.com/convite/x' })
    assert.match(msg, /^Oi, Carla!/)
    assert.match(msg, /Studio Bia/)
    assert.match(msg, /https:\/\/app\.ikizy\.com\/convite\/x$/)
  })
})

describe('meus ganhos', () => {
  const at = (day: number, price: number, status = 'concluido'): EarningAppointment => ({
    id: `${day}-${status}`,
    startsAt: new Date(2026, 9, day, 10),
    price,
    status,
    clientName: 'Ana',
    serviceName: 'Mão',
  })
  it('comissão é o percentual sobre os concluídos do mês', () => {
    const e = monthEarnings([at(2, 80), at(5, 120), at(6, 50, 'faltou'), at(30, 100, 'confirmado'), { ...at(1, 999), startsAt: new Date(2026, 8, 30) }], 40, new Date(2026, 9, 1), new Date(2026, 9, 15))
    assert.equal(e.done.length, 2)
    assert.equal(e.gross, 200)
    assert.equal(e.commission, 80)
    assert.equal(e.upcoming, 1)
    assert.equal(e.done[0].id, '5-concluido')
    assert.equal(e.done[0].commission, 48)
  })
  it('sem percentual definido, a comissão é zero', () => {
    assert.equal(monthEarnings([at(2, 80)], 0, new Date(2026, 9, 1)).commission, 0)
  })
})

describe('acesso de cada profissional', () => {
  const now = new Date(2026, 9, 15)
  it('com login, mostra o perfil', () => {
    assert.deepEqual(professionalAccess({ id: 'p1', userId: 'u1' }, [{ userId: 'u1', role: 'professional' }], [], now), { kind: 'member', role: 'professional' })
  })
  it('com convite em aberto, mostra quando vence', () => {
    const a = professionalAccess({ id: 'p1', userId: null }, [], [{ id: 'i1', professionalId: 'p1', expiresAt: new Date(2026, 9, 18) }], now)
    assert.equal(a.kind, 'invite')
    assert.match(a.kind === 'invite' ? a.label : '', /vence em 3 dias/)
  })
  it('convite vencido não conta', () => {
    assert.equal(professionalAccess({ id: 'p1', userId: null }, [], [{ id: 'i1', professionalId: 'p1', expiresAt: new Date(2026, 9, 14) }], now).kind, 'none')
  })
  it('recepção sem agenda aparece à parte', () => {
    const members = [
      { userId: 'u1', role: 'owner' as const },
      { userId: 'u2', role: 'reception' as const },
    ]
    assert.deepEqual(membersWithoutAgenda(members, [{ id: 'p1', userId: 'u1' }]).map((m) => m.userId), ['u2'])
  })
})

describe('trocar o perfil de um acesso', () => {
  it('perfil profissional só para quem está na agenda', () => {
    assert.deepEqual(assignableRoles('owner', 'salao', false), ['reception', 'manager'])
    assert.deepEqual(assignableRoles('owner', 'salao', true), ['professional', 'reception', 'manager'])
  })
  it('no Studio só existe o perfil profissional', () => {
    assert.deepEqual(assignableRoles('owner', 'studio', true), ['professional'])
  })
  it('gerente não promove a gerente', () => {
    assert.deepEqual(assignableRoles('manager', 'salao', true), ['professional', 'reception'])
  })
})

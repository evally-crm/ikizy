import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { publishSummary } from './summary'

const site = { logo: '', cover: '', tagline: '', about: '', whatsapp: '', hours: '', onlineBooking: false }

describe('resumo ao publicar', () => {
  it('site completo com agendamento online: nada a avisar', () => {
    const r = publishSummary({
      site: { logo: 'x', cover: '', tagline: 'Oi', about: '', whatsapp: '11 9', hours: 'Seg a Sáb · 09h às 19h', onlineBooking: true },
      services: [{ price: 50, visible: true }],
    })
    assert.equal(r.booking, 'online')
    assert.deepEqual(r.warnings, [])
    assert.ok(r.items.every((i) => i.ok))
  })
  it('agendamento desligado com WhatsApp: avisa que só dá para chamar no WhatsApp', () => {
    const r = publishSummary({ site: { ...site, whatsapp: '11 9' }, services: [{ price: 50, visible: true }] })
    assert.equal(r.booking, 'whatsapp')
    assert.match(r.warnings[0], /agendamento online está desligado/)
  })
  it('sem agendamento e sem WhatsApp: a cliente não tem como falar', () => {
    const r = publishSummary({ site, services: [{ price: 50, visible: true }] })
    assert.equal(r.booking, 'none')
    assert.match(r.warnings[0], /não tem como falar/)
  })
  it('serviço sem preço e serviço escondido', () => {
    const r = publishSummary({ site: { ...site, onlineBooking: true }, services: [{ price: 0, visible: true }, { price: 0, visible: true }, { price: 0, visible: false }] })
    assert.equal(r.items.find((i) => i.id === 'servicos')!.detail, '2 serviços, 2 sem preço')
    assert.deepEqual(r.warnings, ['2 serviços estão sem preço.'])
  })
  it('nenhum serviço aparecendo', () => {
    const r = publishSummary({ site: { ...site, onlineBooking: true }, services: [{ price: 40, visible: false }] })
    assert.deepEqual(r.warnings, ['Nenhum serviço aparece na página.'])
  })
})

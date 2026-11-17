import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SUPPORT_EMAIL, supportHref } from './support.js'

describe('supportHref', () => {
  it('abre o e-mail para o suporte com assunto e o contexto de quem pede', () => {
    const href = supportHref({ name: 'Maria', email: 'maria@x.com', salon: 'Studio Maria' })
    assert.ok(href.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`))
    const body = decodeURIComponent(href.split('&body=')[1])
    assert.ok(body.includes('Nome: Maria') && body.includes('E-mail da conta: maria@x.com') && body.includes('Negócio: Studio Maria'))
  })

  it('sem contexto, ainda funciona (modo demonstração)', () => {
    const href = supportHref()
    assert.ok(href.startsWith('mailto:'))
    assert.equal(decodeURIComponent(href.split('&body=')[1]).includes('Nome:'), false)
  })

  it('caracteres especiais não quebram o link', () => {
    const href = supportHref({ salon: 'Salão & Cia "Bela"' })
    assert.equal(href.includes(' '), false)
    assert.ok(decodeURIComponent(href).includes('Salão & Cia "Bela"'))
  })
})

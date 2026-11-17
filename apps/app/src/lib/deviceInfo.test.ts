import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { describeDevice, passwordErrorMessage, toDevices, urlBase64ToBytes } from './deviceInfo.js'

const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const EDGE_WIN = `${CHROME_WIN} Edg/120.0.0.0`
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const FIREFOX_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'

describe('describeDevice', () => {
  it('reconhece navegador e sistema', () => {
    assert.equal(describeDevice(CHROME_WIN), 'Chrome no Windows')
    assert.equal(describeDevice(EDGE_WIN), 'Edge no Windows')
    assert.equal(describeDevice(SAFARI_IPHONE), 'Safari no iPhone')
    assert.equal(describeDevice(CHROME_ANDROID), 'Chrome no Android')
    assert.equal(describeDevice(FIREFOX_MAC), 'Firefox no Mac')
  })

  it('sem informação, não inventa', () => {
    assert.equal(describeDevice(''), 'Aparelho desconhecido')
    assert.equal(describeDevice(null), 'Aparelho desconhecido')
    assert.equal(describeDevice('curl/8.0'), 'Navegador')
  })
})

describe('passwordErrorMessage', () => {
  it('traduz os erros do login', () => {
    assert.equal(passwordErrorMessage({ code: 'INVALID_PASSWORD' }), 'A senha atual não confere.')
    assert.equal(passwordErrorMessage({ message: 'Invalid password' }), 'A senha atual não confere.')
    // como o adaptador do Neon entrega a senha atual errada
    assert.equal(passwordErrorMessage({ code: 'invalid_credentials', status: 401, message: 'Invalid email or password' }), 'A senha atual não confere.')
    assert.equal(passwordErrorMessage({ code: 'PASSWORD_TOO_SHORT' }), 'A nova senha precisa ter pelo menos 8 caracteres.')
    assert.equal(passwordErrorMessage({ status: 429 }), 'Muitas tentativas seguidas. Espere um pouco e tente de novo.')
    assert.match(passwordErrorMessage({ code: 'OUTRO' }), /Não foi possível trocar a senha/)
    assert.match(passwordErrorMessage(null), /Não foi possível trocar a senha/)
  })
})

describe('toDevices', () => {
  it('o aparelho de agora vem primeiro, depois o mais recente', () => {
    const list = toDevices(
      [
        { id: 'ia', token: 'a', userAgent: CHROME_WIN, createdAt: '2026-11-01T10:00:00Z' },
        { id: 'ib', token: 'b', userAgent: SAFARI_IPHONE, createdAt: '2026-11-10T10:00:00Z' },
        { id: 'ic', token: 'c', userAgent: CHROME_ANDROID, createdAt: '2026-11-05T10:00:00Z' },
      ],
      'ia',
    )
    assert.deepEqual(list.map((d) => d.token), ['a', 'b', 'c'])
    assert.deepEqual(list.map((d) => d.current), [true, false, false])
    assert.equal(list[1].label, 'Safari no iPhone')
  })

  it('sem saber qual é o de agora, ninguém é marcado', () => {
    assert.equal(toDevices([{ id: 'ia', token: 'a', createdAt: new Date() }], null)[0].current, false)
  })
})

describe('urlBase64ToBytes', () => {
  it('converte a chave pública dos avisos em bytes (com os caracteres - e _ do base64 para URL)', () => {
    // 65 bytes de uma chave P-256 não comprimida: começa com 0x04
    const bytes = new Uint8Array(65)
    bytes[0] = 4
    for (let i = 1; i < 65; i++) bytes[i] = (i * 37) % 256
    const url = Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    assert.deepEqual([...urlBase64ToBytes(url)], [...bytes])
  })

  it('aceita com e sem o preenchimento "="', () => {
    assert.deepEqual([...urlBase64ToBytes('aGk')], [104, 105])
    assert.deepEqual([...urlBase64ToBytes('aGk=')], [104, 105])
  })
})

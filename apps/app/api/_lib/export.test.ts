import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { describe, it } from 'node:test'
import { inflateRawSync } from 'node:zlib'
import { HttpError } from './billing.js'
import { buildExportZip, crc32, exportData, MAX_ZIP_BYTES, sanitizeRow, toCsv, zipFiles, type ExportData, type ExportDeps } from './export.js'
import type { AuditEntry } from './account.js'

const WHEN = new Date('2026-11-16T15:30:00Z')
const SALON = '11111111-1111-4111-8111-111111111111'

/**
 * leitor de ZIP escrito só pela especificação (lê o diretório central, confere o CRC e o tamanho de cada arquivo):
 * não usa nada do nosso gerador. Verificado também, à mão, com o tar do Windows e o zipfile do Python.
 */
function unzip(bytes: Uint8Array): Record<string, string> {
  const b = Buffer.from(bytes)
  const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  assert.ok(eocd >= 0, 'sem fim de diretório')
  const count = b.readUInt16LE(eocd + 10)
  let at = b.readUInt32LE(eocd + 16)
  const out: Record<string, string> = {}
  for (let i = 0; i < count; i++) {
    assert.equal(b.readUInt32LE(at), 0x02014b50)
    const flags = b.readUInt16LE(at + 8)
    const method = b.readUInt16LE(at + 10)
    const crc = b.readUInt32LE(at + 16)
    const csize = b.readUInt32LE(at + 20)
    const size = b.readUInt32LE(at + 24)
    const nlen = b.readUInt16LE(at + 28)
    const elen = b.readUInt16LE(at + 30)
    const clen = b.readUInt16LE(at + 32)
    const local = b.readUInt32LE(at + 42)
    const name = b.subarray(at + 46, at + 46 + nlen).toString('utf8')
    assert.ok(flags & 0x0800, 'nome sem a marca UTF-8')
    assert.equal(b.readUInt32LE(local), 0x04034b50)
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28)
    assert.equal(method, 8)
    const raw = inflateRawSync(b.subarray(start, start + csize))
    assert.equal(raw.length, size, `${name}: tamanho`)
    assert.equal(crc32(raw), crc, `${name}: crc`)
    out[name] = raw.toString('utf8')
    at += 46 + nlen + elen + clen
  }
  return out
}

const data = (over: Partial<ExportData['tables']> = {}): ExportData => ({
  salon: { id: SALON, name: 'Studio Maria', slug: 'studio-maria', created_at: new Date('2026-10-01T10:00:00Z') },
  subscription: { plan: 'solo', status: 'trialing', access_until: new Date('2026-12-01T00:00:00Z'), billing_method: null },
  team: [{ name: 'Maria', email: 'maria@x.com', role: 'owner', since: new Date('2026-10-01T10:00:00Z') }],
  tables: {
    clients: [
      {
        id: 'c1',
        name: 'Ana "Aninha" Souza',
        phone: '+5511999998888',
        allergies: ['látex', 'amônia'],
        anamnesis: { gestante: false, nota: 'pele sensível' },
        anamnesis_signature: 'data:image/png;base64,AAAA',
        vip: true,
        birthday: '1990-05-17',
      },
      { id: 'c2', name: '=HYPERLINK("http://x")', phone: '', allergies: [], anamnesis: {}, vip: false, birthday: null },
    ],
    appointments: [{ id: 'a1', client_id: 'c1', service_name: 'Corte; escova', starts_at: new Date('2026-11-20T13:00:00Z'), price: '120.00', status: 'concluido' }],
    expenses: [{ id: 'e1', spent_on: '2026-11-01', description: 'Aluguel', amount: '-50.00' }],
    client_photos: [{ id: 'p1', client_id: 'c1', kind: 'antes', caption: 'Antes', data: 'data:image/jpeg;base64,ZZZZ', thumb: 'data:image/jpeg;base64,YYYY' }],
    ...over,
  },
})

describe('CSV', () => {
  it('usa ponto e vírgula, UTF-8 com marca, rótulos em português e aspas só onde precisa', () => {
    const csv = toCsv([{ name: 'Corte; escova', phone: '', vip: true, allergies: ['a', 'b'], created_at: new Date('2026-01-02T03:04:05Z') }])
    const [head, line] = csv.replace('﻿', '').split('\r\n')
    assert.ok(csv.startsWith('﻿'))
    assert.equal(head, 'nome;telefone;vip;alergias;criado_em')
    assert.equal(line, '"Corte; escova";;sim;a | b;2026-01-02T03:04:05.000Z')
  })

  it('escapa aspas, protege contra fórmula e mantém número negativo como número', () => {
    const csv = toCsv([{ name: 'Ana "Aninha"', description: '=1+1', amount: '-50.00', phone: '+5511999998888' }])
    const line = csv.replace('﻿', '').split('\r\n')[1]
    assert.equal(line, '"Ana ""Aninha""";"\'=1+1";-50.00;"\'+5511999998888"')
  })

  it('imagem embutida nunca sai, nem em coluna que não esperávamos', () => {
    assert.deepEqual(sanitizeRow({ name: 'x', anamnesis_signature: 'data:image/png;base64,AA', logo: 'data:image/png;base64,BB', data: 'data:...', thumb: 'data:...' }), { name: 'x', logo: null })
    assert.equal(toCsv([{ name: 'x', logo: 'data:image/png;base64,BB' }]).includes('base64'), false)
  })

  it('sem linhas, não gera arquivo', () => {
    assert.equal(toCsv([]), '')
  })
})

describe('ZIP', () => {
  it('crc32 bate com o valor conhecido', () => {
    assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926)
  })

  it('um leitor feito pela especificação abre o arquivo: conteúdo, CRC, tamanho e nomes acentuados', () => {
    const body = 'nome;telefone\r\nAna;1\r\n'.repeat(500)
    const files = unzip(
      zipFiles(
        [
          { name: 'clientes.csv', data: new TextEncoder().encode(body) },
          { name: 'ação-é-ç.txt', data: new TextEncoder().encode('olá, mundo') },
          { name: 'vazio.txt', data: new Uint8Array() },
        ],
        WHEN,
      ),
    )
    assert.equal(files['clientes.csv'], body)
    assert.equal(files['ação-é-ç.txt'], 'olá, mundo')
    assert.equal(files['vazio.txt'], '')
  })
})

describe('pacote de dados', () => {
  const open = unzip

  it('traz as planilhas, o JSON e o LEIA-ME, e nenhuma imagem', () => {
    const pkg = buildExportZip(data(), WHEN)
    assert.equal(pkg.filename, 'ikizy-dados-studio-maria-2026-11-16.zip')
    const files = open(pkg.bytes)
    assert.deepEqual(Object.keys(files).sort(), ['LEIA-ME.txt', 'atendimentos.csv', 'clientes.csv', 'dados.json', 'equipe.csv', 'fotos-das-clientes.csv', 'negocio.csv', 'saidas.csv'])
    assert.ok(files['clientes.csv'].includes('Ana ""Aninha"" Souza'))
    assert.ok(files['clientes.csv'].includes('látex | amônia'))
    assert.ok(files['clientes.csv'].includes('\'=HYPERLINK'))
    assert.ok(files['saidas.csv'].includes('-50.00'))
    assert.ok(files['negocio.csv'].includes('Studio Maria') && files['negocio.csv'].includes('solo'))
    assert.ok(files['equipe.csv'].includes('maria@x.com'))
    for (const [name, text] of Object.entries(files)) assert.equal(text.includes('base64'), false, `${name} tem imagem`)
    const json = JSON.parse(files['dados.json'])
    assert.equal(json.clientes?.length ?? json.clients.length, 2)
    assert.equal(json.negocio.slug, 'studio-maria')
    assert.ok(files['LEIA-ME.txt'].includes('NÃO vem') && files['LEIA-ME.txt'].includes('clientes.csv'))
  })

  it('não vaza nada que não é do negócio: só as tabelas da lista entram', () => {
    const extra = data({ subscriptions: [{ stripe_customer_id: 'cus_secreto' }], invites: [{ token: 'segredo-do-convite' }] } as Partial<ExportData['tables']>)
    const files = open(buildExportZip(extra, WHEN).bytes)
    for (const text of Object.values(files)) assert.equal(/cus_secreto|segredo-do-convite/.test(text), false)
  })

  it('arquivo grande demais: tira o JSON e, se ainda passar, recusa com 413', () => {
    // dados aleatórios não comprimem: é o pior caso para o teto de 4 MB
    const noise = (n: number, size: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), name: randomBytes(size).toString('base64'), allergies: [], anamnesis: {} }))
    // ~2,7 MB de planilha + ~2,7 MB de JSON: só cabe sem o JSON
    const medium = buildExportZip(data({ clients: noise(1800, 1500) }), WHEN)
    assert.ok(medium.bytes.length <= MAX_ZIP_BYTES)
    assert.equal('dados.json' in unzip(medium.bytes), false)
    assert.throws(() => buildExportZip(data({ clients: noise(3000, 1500) }), WHEN), (e) => e instanceof HttpError && e.status === 413)
  })
})

describe('quem pode baixar', () => {
  const setup = (role: 'owner' | 'manager' | null) => {
    const audits: AuditEntry[] = []
    const deps: ExportDeps = {
      db: {
        async getMembership() {
          return role ? { salonId: SALON, salonName: 'Studio Maria', role } : null
        },
        async salonInfo() {
          return { name: 'Studio Maria', slug: 'studio-maria', deletionScheduledAt: null, resumeBilling: false }
        },
        async audit(e) {
          audits.push(e)
        },
      },
      load: async (id) => {
        assert.equal(id, SALON)
        return data()
      },
      now: () => WHEN,
    }
    return { deps, audits }
  }

  it('a dona baixa e o pedido fica no registro', async () => {
    const { deps, audits } = setup('owner')
    const pkg = await exportData(deps, { id: 'u1', email: 'maria@x.com' })
    assert.ok(pkg.bytes.length > 100)
    assert.equal(audits[0].action, 'owner.export_data')
    assert.equal(audits[0].salonSlug, 'studio-maria')
    assert.equal(typeof audits[0].details?.bytes, 'number')
  })

  it('gerente, equipe e quem não tem negócio recebem 403 e nada é carregado', async () => {
    for (const role of ['manager', null] as const) {
      const { deps, audits } = setup(role)
      deps.load = async () => {
        throw new Error('não podia carregar')
      }
      await assert.rejects(exportData(deps, { id: 'u2' }), (e) => e instanceof HttpError && e.status === 403)
      assert.deepEqual(audits, [])
    }
  })
})

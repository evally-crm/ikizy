import { deflateRawSync } from 'node:zlib'
import { HttpError, type Membership } from './billing.js'
import type { AuditEntry, SalonInfo } from './account.js'

/**
 * exportar os dados do negócio (LGPD, portabilidade): um ZIP com uma planilha (CSV) por assunto e um `dados.json` completo.
 * Só a dona exporta. Ficam de fora as imagens (fotos e assinaturas): o ZIP precisa caber na resposta da função (4,5 MB)
 * e as fotos continuam no app. O arquivo `LEIA-ME.txt` diz isso, e o que cada planilha tem.
 */

export type Row = Record<string, unknown>

/** o que o banco devolve para montar o arquivo: linhas puras, sem dado de outro negócio */
export interface ExportData {
  salon: Row
  subscription: Row | null
  /** quem tem login no negócio (nome, e-mail, perfil) */
  team: Row[]
  /** uma entrada por tabela do negócio, pelo nome da tabela */
  tables: Record<string, Row[]>
}

export interface ExportDeps {
  db: {
    getMembership(userId: string): Promise<Membership | null>
    salonInfo(salonId: string): Promise<SalonInfo | null>
    audit(entry: AuditEntry): Promise<void>
  }
  load(salonId: string): Promise<ExportData>
  now?: () => Date
}

/** teto do ZIP: a função da Vercel responde no máximo 4,5 MB */
export const MAX_ZIP_BYTES = 4 * 1024 * 1024

/** colunas que nunca saem (guardam imagem ou segredo) */
const DROP_COLUMNS = new Set(['anamnesis_signature', 'data', 'thumb'])

// ---------------------------------------------------------------- CSV

/** rótulos das colunas em português (as que não estão aqui saem com o nome do banco) */
const LABEL: Record<string, string> = {
  id: 'id',
  name: 'nome',
  slug: 'endereco_do_site',
  phone: 'telefone',
  email: 'email',
  birthday: 'aniversario',
  vip: 'vip',
  allergies: 'alergias',
  preferences: 'preferencias',
  address: 'endereco',
  occupation: 'profissao',
  referral: 'indicacao',
  instagram: 'instagram',
  whatsapp: 'whatsapp',
  anamnesis: 'anamnese',
  anamnesis_signed_at: 'anamnese_assinada_em',
  anamnesis_updated_at: 'anamnese_atualizada_em',
  forgotten_at: 'dados_apagados_em',
  created_at: 'criado_em',
  title: 'cargo',
  commission_pct: 'comissao_percentual',
  active: 'ativo',
  category: 'categoria',
  price: 'preco',
  duration: 'duracao_minutos',
  visible: 'visivel',
  starts_at: 'inicio',
  service_name: 'servico',
  status: 'situacao',
  payment_method: 'forma_de_pagamento',
  origin: 'origem',
  client_id: 'id_cliente',
  professional_id: 'id_profissional',
  service_id: 'id_servico',
  spent_on: 'data',
  description: 'descricao',
  amount: 'valor',
  body: 'texto',
  month: 'mes',
  closed_at: 'fechado_em',
  snapshot: 'resumo_do_mes',
  weekday: 'dia_da_semana',
  start_minute: 'inicio_em_minutos',
  end_minute: 'fim_em_minutos',
  monthly_spend: 'gasto_mensal',
  role: 'perfil',
  since: 'desde',
  caption: 'legenda',
  kind: 'tipo',
  taken_on: 'tirada_em',
  tagline: 'frase',
  about: 'sobre',
  hours: 'horarios',
  published: 'publicado',
  position: 'posicao',
}

const label = (key: string) => LABEL[key] ?? key

/** um valor vira texto de planilha: data em ISO, lista com " | ", objeto como JSON; imagem embutida nunca sai */
function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((v) => cell(v)).join(' | ')
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'sim' : 'não'
  const text = String(value)
  return text.startsWith('data:') ? '' : text
}

/** tira da linha o que não sai (colunas de imagem e valores que são imagem embutida) */
export function sanitizeRow(row: Row): Row {
  const out: Row = {}
  for (const [key, value] of Object.entries(row)) {
    if (DROP_COLUMNS.has(key)) continue
    out[key] = typeof value === 'string' && value.startsWith('data:') ? null : value
  }
  return out
}

/** CSV para Excel em português: separador `;`, texto UTF-8 com marca de ordem e aspas só onde precisa; vazio se não há linhas */
export function toCsv(rows: Row[]): string {
  if (!rows.length) return ''
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  // texto que o Excel leria como fórmula (começa com = + - @) ganha um apóstrofo; número de verdade (ex.: -50,00) fica como está
  const formula = (s: string) => /^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)
  const quote = (s: string) => (/[;"\r\n]/.test(s) || formula(s) ? `"${(formula(s) ? "'" + s : s).replace(/"/g, '""')}"` : s)
  const lines = [keys.map((k) => quote(label(k))).join(';'), ...rows.map((r) => keys.map((k) => quote(cell(r[k]))).join(';'))]
  return '﻿' + lines.join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------- ZIP

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipFile {
  name: string
  data: Uint8Array
}

/** ZIP comum (deflate), nomes em UTF-8: abre no Windows, no Mac e no celular sem programa extra */
export function zipFiles(files: ZipFile[], when: Date): Uint8Array {
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1)
  const dosDate = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate()
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8')
    const raw = Buffer.from(f.data)
    const packed = deflateRawSync(raw)
    const crc = crc32(raw)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // versão mínima
    local.writeUInt16LE(0x0800, 6) // nome em UTF-8
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt16LE(dosTime, 10)
    local.writeUInt16LE(dosDate, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    parts.push(local, name, packed)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt16LE(dosTime, 12)
    entry.writeUInt16LE(dosDate, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(packed.length, 20)
    entry.writeUInt32LE(raw.length, 24)
    entry.writeUInt16LE(name.length, 28)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, name)

    offset += local.length + name.length + packed.length
  }

  const centralBytes = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...parts, centralBytes, end]))
}

// ---------------------------------------------------------------- o pacote

/** nome de cada planilha e o que ela guarda, na ordem do LEIA-ME */
const SHEETS: { table: string; file: string; about: string }[] = [
  { table: 'professionals', file: 'profissionais.csv', about: 'quem atende na agenda' },
  { table: 'services', file: 'servicos.csv', about: 'serviços, preços e durações' },
  { table: 'products', file: 'produtos.csv', about: 'produtos e gasto mensal' },
  { table: 'clients', file: 'clientes.csv', about: 'ficha das clientes: contato, aniversário, alergias, preferências e anamnese (sem a imagem da assinatura)' },
  { table: 'client_notes', file: 'anotacoes-das-clientes.csv', about: 'anotações nas fichas' },
  { table: 'client_photos', file: 'fotos-das-clientes.csv', about: 'só a lista das fotos (legenda e data); as imagens não vão neste arquivo' },
  { table: 'appointments', file: 'atendimentos.csv', about: 'agenda e histórico de atendimentos, com valores e forma de pagamento' },
  { table: 'expenses', file: 'saidas.csv', about: 'saídas e custos lançados no financeiro' },
  { table: 'month_closings', file: 'fechamentos-do-mes.csv', about: 'meses fechados, com o resumo guardado' },
  { table: 'working_hours', file: 'horarios.csv', about: 'horário de atendimento de cada profissional' },
  { table: 'client_plans', file: 'planos-do-site.csv', about: 'planos e pacotes mostrados no site' },
  { table: 'showcase_items', file: 'vitrine-do-site.csv', about: 'itens da vitrine do site' },
  { table: 'site_settings', file: 'site.csv', about: 'textos e configurações do seu site' },
  { table: 'site_photos', file: 'fotos-do-site.csv', about: 'só a lista das fotos do site; as imagens não vão neste arquivo' },
]

const BYTES = (text: string) => new TextEncoder().encode(text)

function readme(data: ExportData, when: Date, sheets: { file: string; about: string; rows: number }[], withJson: boolean): string {
  const day = when.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return [
    `IKIZY: cópia dos dados de ${String(data.salon.name ?? '')}`,
    `Gerada em ${day}.`,
    '',
    'O que tem aqui',
    '--------------',
    '- negocio.csv: dados do negócio e do plano',
    '- equipe.csv: quem tem login no negócio (nome, e-mail e perfil)',
    ...sheets.map((s) => `- ${s.file}: ${s.about} (${s.rows} ${s.rows === 1 ? 'linha' : 'linhas'})`),
    ...(withJson ? ['- dados.json: tudo isso junto, em formato para outros sistemas lerem'] : []),
    '',
    'O que NÃO vem',
    '-------------',
    'As imagens (fotos de antes e depois, fotos do site e assinaturas) ficam de fora, porque este arquivo tem tamanho limitado.',
    'Elas continuam no IKIZY enquanto a conta existir. As planilhas listam as fotos que existem.',
    '',
    'Como abrir',
    '----------',
    'As planilhas usam ponto e vírgula e acentos em UTF-8. No Excel: Dados > De Texto/CSV, e escolha "UTF-8" e "Ponto e vírgula".',
    'No Google Planilhas: Arquivo > Importar > Enviar, e deixe o separador em "Detectar automaticamente".',
    '',
    'Atenção: este arquivo tem dados pessoais das suas clientes e da sua equipe. Guarde num lugar seguro e, se não for mais precisar, apague.',
    '',
  ].join('\r\n')
}

export interface ExportPackage {
  filename: string
  bytes: Uint8Array
  /** linhas por arquivo, para o registro */
  rows: number
}

/** monta o ZIP; se passar do teto, tenta de novo sem o `dados.json` (as planilhas já têm tudo) */
export function buildExportZip(data: ExportData, when: Date): ExportPackage {
  const clean = (rows: Row[]) => rows.map(sanitizeRow)
  const tables: Record<string, Row[]> = {}
  for (const s of SHEETS) tables[s.table] = clean(data.tables[s.table] ?? [])
  const team = clean(data.team)
  const salon = sanitizeRow({ ...data.salon, ...(data.subscription ? sanitizeRow(data.subscription) : {}) })

  const sheetInfo = SHEETS.map((s) => ({ file: s.file, about: s.about, rows: tables[s.table].length }))
  const csvFiles: ZipFile[] = [
    { name: 'negocio.csv', data: BYTES(toCsv([salon])) },
    { name: 'equipe.csv', data: BYTES(toCsv(team)) },
    ...SHEETS.filter((s) => tables[s.table].length).map((s) => ({ name: s.file, data: BYTES(toCsv(tables[s.table])) })),
  ]
  const json: ZipFile = { name: 'dados.json', data: BYTES(JSON.stringify({ geradoEm: when.toISOString(), negocio: salon, equipe: team, ...tables }, null, 2)) }

  const build = (withJson: boolean) =>
    zipFiles([{ name: 'LEIA-ME.txt', data: BYTES(readme(data, when, sheetInfo, withJson)) }, ...csvFiles, ...(withJson ? [json] : [])], when)
  let bytes = build(true)
  if (bytes.length > MAX_ZIP_BYTES) bytes = build(false)
  if (bytes.length > MAX_ZIP_BYTES) throw new HttpError(413, 'too_large', 'Seus dados passam do tamanho que dá para baixar de uma vez. Fale com a gente pelo site para receber por outro caminho.')

  const slug = String(data.salon.slug ?? 'negocio').replace(/[^a-z0-9-]/gi, '')
  const stamp = when.toISOString().slice(0, 10)
  const rows = sheetInfo.reduce((n, s) => n + s.rows, 0) + team.length + 1
  return { filename: `ikizy-dados-${slug}-${stamp}.zip`, bytes, rows }
}

/** a dona baixa os dados do próprio negócio; o pedido fica no registro */
export async function exportData(deps: ExportDeps, user: { id: string; email?: string }): Promise<ExportPackage> {
  const member = await deps.db.getMembership(user.id)
  if (member?.role !== 'owner') throw new HttpError(403, 'forbidden', 'Só a dona pode baixar os dados do negócio.')
  const info = await deps.db.salonInfo(member.salonId)
  if (!info) throw new HttpError(404, 'not_found', 'Negócio não encontrado.')

  const when = (deps.now ?? (() => new Date()))()
  const pkg = buildExportZip(await deps.load(member.salonId), when)
  await deps.db
    .audit({
      actorKind: 'owner',
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: 'owner.export_data',
      salonId: member.salonId,
      salonName: info.name,
      salonSlug: info.slug,
      details: { bytes: pkg.bytes.length, rows: pkg.rows },
    })
    .catch(() => undefined)
  return pkg
}

/**
 * Confere as regras da casa (docs/CONVENCOES.md) nos arquivos já organizados.
 *
 *   npm run check:conventions
 *
 * Só olha os caminhos de `SCOPES`: cada fase de organização acrescenta aqui o que ficou limpo, e a partir daí
 * o arquivo não pode voltar a ter cor solta, estilo inline nem regra de negócio dentro do componente.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'src')

/** pastas e arquivos (relativos a src/) que já seguem as regras */
const SCOPES = [
  'domain',
  'components/charts',
  'components/finance',
  'pages/financeiro',
  'styles/finance.css',
]

/** imports que a camada de domínio nunca pode ter: ela é função pura, sem tela, banco nem sessão */
const DOMAIN_FORBIDDEN = ['react', 'react-dom', 'react-router-dom', 'lucide-react', '/data/', '/components/', '/pages/', '/auth/', '/lib/neon', '@neondatabase']

const HEX = /#[0-9a-fA-F]{3,8}\b/
const COLOR_FN = /\b(?:rgba?|hsla?)\(/

function walk(path) {
  let stat
  try {
    stat = statSync(path)
  } catch {
    return []
  }
  if (stat.isFile()) return [path]
  return readdirSync(path).flatMap((name) => walk(join(path, name)))
}

const files = SCOPES.flatMap((scope) => walk(join(src, scope)))
const problems = []
const report = (file, line, message) => problems.push(`${relative(src, file).split(sep).join('/')}:${line}  ${message}`)

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)
  const isCss = file.endsWith('.css')
  const isTsx = file.endsWith('.tsx')
  const isTest = file.endsWith('.test.ts')
  const inDomain = relative(src, file).split(sep)[0] === 'domain'

  lines.forEach((raw, i) => {
    const n = i + 1
    const line = raw.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '')
    if (isCss) {
      // cor só vem dos tokens (styles/tokens.css); aqui usa var(--...) ou color-mix
      if (HEX.test(line) || COLOR_FN.test(line)) report(file, n, 'cor solta: use um token (var(--...))')
    }
    if (isTsx) {
      if (/style=\{\{/.test(line) && !/'--[\w-]+'|"--[\w-]+"|\[`--|\['--/.test(line) && !/--[\w-]+\s*:/.test(line)) {
        report(file, n, 'style inline: passe o valor por variável CSS (style={{ "--x": valor }}) e estilize na folha de estilo')
      }
      if (/\.reduce\(|Math\.(?:max|min|round)\(/.test(line)) report(file, n, 'cálculo dentro do componente: mova para src/domain/')
      if (HEX.test(line)) report(file, n, 'cor solta no componente: use classe e token')
    }
    if (inDomain && !isTest) {
      const m = line.match(/from\s+['"]([^'"]+)['"]/)
      if (m && DOMAIN_FORBIDDEN.some((bad) => m[1] === bad || m[1].includes(bad))) {
        report(file, n, `domínio não pode importar "${m[1]}" (só funções puras)`)
      }
    }
  })
}

if (problems.length) {
  console.error(`✖ ${problems.length} problema(s) nas regras da casa:\n` + problems.map((p) => '  ' + p).join('\n'))
  process.exit(1)
}
console.log(`✔ regras da casa ok (${files.length} arquivos conferidos)`)

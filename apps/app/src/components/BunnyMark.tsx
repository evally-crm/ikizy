/** contorno do coelho da logo oficial, num quadro de 140 x 260 (largura do k x altura do i, mais um tiquinho abaixo da linha de base) */
const BODY = 'M0 5Q0 0 5 0H39Q44 0 44 5L35 135Q35 140 40 140H101Q105 140 105 136V76Q105 71 110 71H134Q139 71 139 76V134Q139 139 134 139H112Q108 139 108 143V171Q108 176 113 176H134Q139 176 139 181V240C139 252 105 260 69.5 260S0 252 0 240Z'
const EYES = 'M41 183H47V196H54V202H41V215H34V202H28V196H41ZM98 183H104V196H111V202H98V215H91V202H85V196H98Z'
const MOUTH = 'M61 213H78V217H61Z'

/**
 * coelho da marca, traçado da logo oficial: orelha esquerda alta (o traço do k), a direita mais curta (o braço),
 * com o recorte do k embaixo dela; olhos em + e a boca vazados (mostram o fundo). usa a cor do texto.
 */
export function BunnyMark({ className }: { className?: string }) {
  return (
    <svg className={className ? `bunny-mark ${className}` : 'bunny-mark'} viewBox="0 0 140 260" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d={BODY + EYES + MOUTH}
      />
    </svg>
  )
}

/** o nome nos logos: o coelho no lugar do k, sem ponto no fim; leitores de tela ouvem "ikizy" */
export function LogoWord() {
  return (
    <>
      <span className="sr-only">ikizy</span>
      <span aria-hidden="true">
        i<BunnyMark className="logo__k" />izy
      </span>
    </>
  )
}

/** o coelho em traço que ocupa o espaço das listas vazias: olhos em + e a boquinha vinho */
export function EmptyBunny() {
  return (
    <svg className="empty-bunny" viewBox="-4 -4 148 268" aria-hidden="true" focusable="false">
      <path d={BODY} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <path d={EYES} fill="currentColor" />
      <path className="empty-bunny__mouth" d={MOUTH} fill="currentColor" />
    </svg>
  )
}

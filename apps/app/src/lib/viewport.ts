/**
 * altura da área realmente visível. Navegadores dentro de apps (Google, Instagram) e o Safari do iPhone mudam a barra de baixo
 * enquanto a pessoa rola, e telas fixas (inset: 0, 100dvh) ficavam com a altura de antes: sobrava uma faixa vazia embaixo ou o fim
 * ficava escondido. As telas fixas usam --vvh e --vvt (altura e distância do topo da área visível), com 100dvh como reserva.
 */
export function trackVisualViewport() {
  const v = window.visualViewport
  if (!v) return
  const root = document.documentElement
  let frame = 0
  const apply = () => {
    frame = 0
    root.style.setProperty('--vvh', `${Math.round(v.height)}px`)
    root.style.setProperty('--vvt', `${Math.round(v.offsetTop)}px`)
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(apply)
  }
  apply()
  v.addEventListener('resize', schedule)
  v.addEventListener('scroll', schedule)
  window.addEventListener('orientationchange', schedule)
}

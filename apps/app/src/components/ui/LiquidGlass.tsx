import { useId, useLayoutEffect, useMemo, useState, type CSSProperties, type RefObject } from 'react'
import { glassMaps, supportsLiquidGlass, type GlassShape } from '../../lib/liquidGlass'

export interface GlassLook {
  /** desfoque do fundo antes de entortar */
  blur?: number
  /** saturação do fundo visto pelo vidro */
  saturation?: number
  /** força do brilho da borda (0–1) */
  specular?: number
  /** multiplica a refração (0 tira, 1 é a física) */
  refraction?: number
}

/** o filtro SVG de uma peça de vidro; vai num <svg> invisível e é usado por `backdrop-filter: url(#id)` */
export function GlassFilter({ id, blur = 0.6, saturation = 1.6, specular = 0.55, refraction = 1, ...shape }: GlassShape & GlassLook & { id: string }) {
  const maps = useMemo(() => (supportsLiquidGlass ? glassMaps(shape) : null), [shape.width, shape.height, shape.radius, shape.bezel, shape.thickness]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!maps) return null
  const w = Math.round(shape.width)
  const h = Math.round(shape.height)
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <filter id={id} x="0" y="0" width={w} height={h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blurred" />
        <feImage href={maps.displacement} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="blurred" in2="map" scale={maps.scale * refraction} xChannelSelector="R" yChannelSelector="G" result="bent" />
        <feColorMatrix in="bent" type="saturate" values={String(saturation)} result="tinted" />
        <feImage href={maps.specular} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="rim" />
        <feComponentTransfer in="rim" result="rimFaded">
          <feFuncA type="linear" slope={specular} />
        </feComponentTransfer>
        <feBlend in="rimFaded" in2="tinted" mode="screen" />
      </filter>
    </svg>
  )
}

/**
 * vidro líquido numa peça que muda de tamanho: mede a peça (sem contar `transform`) e refaz o mapa quando ela muda.
 * Devolve o `--lg` para o CSS usar em `backdrop-filter: var(--lg, <vidro desfocado de reserva>)` e o filtro para renderizar junto.
 */
export function useLiquidGlass(ref: RefObject<HTMLElement | null>, opts: Omit<GlassShape, 'width' | 'height'> & GlassLook = {}) {
  const id = `lg${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const measure = () => {
    const el = ref.current
    if (!el || !supportsLiquidGlass) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }))
  }
  // a cada render: a largura da lente/pílula costuma vir de uma variável CSS que o próprio componente acabou de mudar
  useLayoutEffect(measure)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !supportsLiquidGlass) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    // a pílula das abas anima a largura: mede de novo quando a animação termina
    el.addEventListener('transitionend', measure)
    return () => {
      ro.disconnect()
      el.removeEventListener('transitionend', measure)
    }
  }, [ref]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!size || size.w < 2 || size.h < 2 || !supportsLiquidGlass) return { style: undefined, filter: null }
  return {
    style: { '--lg': `url(#${id})` } as CSSProperties,
    filter: <GlassFilter id={id} width={size.w} height={size.h} {...opts} />,
  }
}

/** filtros de tamanho fixo usados direto no CSS (a bolinha das chaves liga/desliga é um ::after, sem componente próprio) */
export function GlassDefs() {
  useLayoutEffect(() => {
    if (!supportsLiquidGlass) return
    const root = document.documentElement.style
    root.setProperty('--lg-switch', 'url(#lg-switch)')
    return () => {
      root.removeProperty('--lg-switch')
    }
  }, [])
  // a bolinha esticada: 26×18 (o CSS só aumenta com `scale`, o mapa acompanha)
  return <GlassFilter id="lg-switch" width={26} height={18} bezel={8} thickness={12} blur={0.3} specular={0.8} />
}

import { useEffect, useRef } from 'react'

const STEP = 9
const INK = '#1b1b1d'

/** campo de pontos em meio-tom: ondas fluidas (fios), mais densas à direita e se dissolvendo à esquerda */
function draw(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const { width, height } = canvas.getBoundingClientRect()
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = INK

  for (let y = STEP / 2; y < height; y += STEP) {
    for (let x = STEP / 2; x < width; x += STEP) {
      const wave =
        Math.sin(x * 0.012 + Math.sin(y * 0.009) * 2.4) +
        Math.sin(y * 0.014 - x * 0.007 + 1.7) * 0.8 +
        Math.sin((x + y) * 0.006 + Math.sin(x * 0.01) * 1.6) * 0.6
      const v = (wave + 2.4) / 4.8 // 0..1
      const fadeLeft = Math.min(1, Math.max(0, (x / width - 0.04) * 2.2))
      const fadeEdge = 0.35 + 0.65 * Math.min(1, y / height + 0.2)
      const size = Math.pow(v, 1.6) * STEP * 0.62 * fadeLeft * fadeEdge
      if (size < 0.5) continue
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function HalftoneArt() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    draw(canvas)
    const observer = new ResizeObserver(() => draw(canvas))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  return <canvas ref={ref} className="auth__art" aria-hidden="true" />
}

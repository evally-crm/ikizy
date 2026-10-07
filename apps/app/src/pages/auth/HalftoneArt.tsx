import { useEffect, useRef } from 'react'

const STEP = 9
const INK = '27, 27, 29'
const FRAME_MS = 1000 / 30

/** campo de pontos em meio-tom: ondas fluidas (fios) que se movem devagar; parado se o usuário prefere menos movimento */
function draw(canvas: HTMLCanvasElement, t: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const { width, height } = canvas.getBoundingClientRect()
  const w = Math.round(width * dpr)
  const h = Math.round(height * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = `rgb(${INK})`

  for (let y = STEP / 2; y < height; y += STEP) {
    for (let x = STEP / 2; x < width; x += STEP) {
      const wave =
        Math.sin(x * 0.012 + Math.sin(y * 0.009 + t * 0.6) * 2.4 + t) +
        Math.sin(y * 0.014 - x * 0.007 + 1.7 - t * 0.8) * 0.8 +
        Math.sin((x + y) * 0.006 + Math.sin(x * 0.01 - t * 0.5) * 1.6) * 0.6
      const v = (wave + 2.4) / 4.8 // 0..1
      const size = Math.pow(v, 2.2) * STEP * 0.55
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
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now
        draw(canvas, now / 4000)
      }
      frame = requestAnimationFrame(tick)
    }
    if (still) draw(canvas, 0)
    else frame = requestAnimationFrame(tick)
    const observer = new ResizeObserver(() => still && draw(canvas, 0))
    observer.observe(canvas)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return <canvas ref={ref} className="auth__art" aria-hidden="true" />
}

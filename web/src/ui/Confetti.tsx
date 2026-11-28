// 礼炮：从屏幕下面两个角往上喷彩纸，再从上面飘彩带，一共放 seconds 秒（默认 30 秒）。replay 变了就从头再放
import { useEffect, useRef } from 'react'

const COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#af52de', '#ff9f0a', '#ff2d92']
const color = () => COLORS[Math.floor(Math.random() * COLORS.length)]

export function Confetti({ replay = 0, seconds = 30 }: { replay?: number; seconds?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    if (!host || !host.animate) return
    const timers: number[] = []
    const animations = new Set<Animation>()

    const piece = (left: number, top: number, size: number) => {
      const el = document.createElement('div')
      el.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size * 0.55}px;background:${color()};border-radius:2px;`
      host.appendChild(el)
      return el
    }
    const run = (el: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      const a = el.animate(frames, { fill: 'forwards', ...options })
      animations.add(a)
      // 落完就删掉，放 30 秒也不会越积越多
      a.onfinish = () => { animations.delete(a); el.remove() }
    }

    /** 两个角各喷一把 */
    const burst = (count: number) => {
      const w = window.innerWidth
      const h = window.innerHeight
      for (let side = 0; side < 2; side++) {
        for (let i = 0; i < count; i++) {
          const el = piece(side ? w - 14 : 6, h - 6, 7 + Math.random() * 7)
          const dx = (side ? -1 : 1) * (w * 0.15 + Math.random() * w * 0.75)
          const up = h * (0.4 + Math.random() * 0.5)
          const spin = (Math.random() - 0.5) * 1440
          run(el, [
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${dx * 0.65}px, ${-up}px) rotate(${spin * 0.5}deg)`, opacity: 1, offset: 0.4 },
            { transform: `translate(${dx}px, ${-up + h * 0.7}px) rotate(${spin}deg)`, opacity: 0 },
          ], { duration: 2200 + Math.random() * 1600, delay: side * 180 + Math.random() * 250, easing: 'cubic-bezier(.15,.75,.35,1)' })
        }
      }
    }

    /** 从上面飘下来的彩带 */
    const rain = (count: number) => {
      const w = window.innerWidth
      const h = window.innerHeight
      for (let i = 0; i < count; i++) {
        const el = piece(Math.random() * w, -20, 6 + Math.random() * 6)
        const drift = (Math.random() - 0.5) * 160
        run(el, [
          { transform: 'translate(0, 0) rotate(0deg)' },
          { transform: `translate(${drift}px, ${h + 40}px) rotate(${(Math.random() - 0.5) * 1080}deg)` },
        ], { duration: 3500 + Math.random() * 3000, delay: Math.random() * 1500, easing: 'linear' })
      }
    }

    const end = seconds * 1000
    burst(70)
    for (let t = 2500; t < end - 3000; t += 2500) timers.push(window.setTimeout(() => burst(35), t))
    for (let t = 800; t < end - 6000; t += 1500) timers.push(window.setTimeout(() => rain(14), t))
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      animations.forEach((a) => a.cancel())
      host.replaceChildren()
    }
  }, [replay, seconds])
  return <div ref={ref} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 80 }} />
}

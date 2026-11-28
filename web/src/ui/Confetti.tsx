// 礼炮：从屏幕下面两个角往上喷彩纸，飘一会儿落下消失。replay 变了就再放一次
import { useEffect, useRef } from 'react'

const COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#af52de', '#ff9f0a', '#ff2d92']

export function Confetti({ replay = 0 }: { replay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    if (!host || !host.animate) return
    const w = window.innerWidth
    const h = window.innerHeight
    const animations: Animation[] = []
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 70; i++) {
        const piece = document.createElement('div')
        const size = 7 + Math.random() * 7
        piece.style.cssText = `position:absolute;left:${side ? w - 14 : 6}px;top:${h - 6}px;width:${size}px;height:${size * 0.55}px;`
          + `background:${COLORS[(i + side) % COLORS.length]};border-radius:2px;`
        host.appendChild(piece)
        const dir = side ? -1 : 1
        const dx = dir * (w * 0.15 + Math.random() * w * 0.75)
        const up = h * (0.4 + Math.random() * 0.5)
        const spin = (Math.random() - 0.5) * 1440
        animations.push(piece.animate([
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
          { transform: `translate(${dx * 0.65}px, ${-up}px) rotate(${spin * 0.5}deg)`, opacity: 1, offset: 0.4 },
          { transform: `translate(${dx}px, ${-up + h * 0.7}px) rotate(${spin}deg)`, opacity: 0 },
        ], { duration: 2200 + Math.random() * 1600, delay: side * 180 + Math.random() * 250, easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'forwards' }))
      }
    }
    return () => {
      animations.forEach((a) => a.cancel())
      host.replaceChildren()
    }
  }, [replay])
  return <div ref={ref} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 80 }} />
}

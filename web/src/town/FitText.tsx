// 单行文字，放不下时缩小字号，对应 SwiftUI 的 .lineLimit(1).minimumScaleFactor(x)
import { useLayoutEffect, useRef, useState } from 'react'

export function FitText({ text, fontSize, minScale, style }: {
  text: string
  fontSize: number
  minScale: number
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const inner = el.firstElementChild as HTMLElement | null
      if (!inner) return
      const avail = el.clientWidth
      const need = inner.offsetWidth / scaleRef.current
      const next = need > avail && need > 0 ? Math.max(minScale, avail / need) : 1
      if (Math.abs(next - scaleRef.current) > 0.005) { scaleRef.current = next; setScale(next) }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, fontSize, minScale])

  return (
    <div ref={ref} style={{ minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', ...style, fontSize: fontSize * scale }}>
      <span>{text}</span>
    </div>
  )
}

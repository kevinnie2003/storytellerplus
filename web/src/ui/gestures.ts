// SwiftUI 的 onTapGesture(count: 1/2) 和 onLongPressGesture，用指针事件实现。
// 有双击处理时，单击要等一下确认不是双击再触发，和 SwiftUI 的表现一样。
import { useRef } from 'react'

export interface PressOptions {
  onTap?: () => void
  onDoubleTap?: () => void
  onLongPress?: () => void
  /** 长按要按多久，秒，默认 0.5 */
  longPressSeconds?: number
}

const DOUBLE_TAP_MS = 280
const MOVE_TOLERANCE = 10

export function usePress(opts: PressOptions) {
  const ref = useRef({
    downAt: 0, x: 0, y: 0, longTimer: 0 as number | 0, longFired: false,
    lastTapAt: 0, tapTimer: 0 as number | 0, active: false,
  })
  const o = useRef(opts)
  o.current = opts

  const clearLong = () => {
    if (ref.current.longTimer) window.clearTimeout(ref.current.longTimer)
    ref.current.longTimer = 0
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      const r = ref.current
      r.active = true
      r.downAt = Date.now()
      r.x = e.clientX
      r.y = e.clientY
      r.longFired = false
      clearLong()
      if (o.current.onLongPress) {
        r.longTimer = window.setTimeout(() => {
          r.longFired = true
          r.active = false
          o.current.onLongPress?.()
        }, (o.current.longPressSeconds ?? 0.5) * 1000)
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const r = ref.current
      if (!r.active) return
      if (Math.abs(e.clientX - r.x) > MOVE_TOLERANCE || Math.abs(e.clientY - r.y) > MOVE_TOLERANCE) {
        r.active = false
        clearLong()
      }
    },
    onPointerCancel: () => { ref.current.active = false; clearLong() },
    onPointerLeave: () => { ref.current.active = false; clearLong() },
    onPointerUp: () => {
      const r = ref.current
      clearLong()
      if (!r.active || r.longFired) { r.active = false; return }
      r.active = false
      const now = Date.now()
      if (o.current.onDoubleTap) {
        if (r.tapTimer && now - r.lastTapAt < DOUBLE_TAP_MS) {
          window.clearTimeout(r.tapTimer)
          r.tapTimer = 0
          r.lastTapAt = 0
          o.current.onDoubleTap()
          return
        }
        r.lastTapAt = now
        if (o.current.onTap) {
          r.tapTimer = window.setTimeout(() => { r.tapTimer = 0; o.current.onTap?.() }, DOUBLE_TAP_MS)
        } else {
          r.tapTimer = window.setTimeout(() => { r.tapTimer = 0 }, DOUBLE_TAP_MS)
        }
        return
      }
      o.current.onTap?.()
    },
    onContextMenu: (e: React.MouseEvent) => { if (o.current.onLongPress) e.preventDefault() },
  }
}

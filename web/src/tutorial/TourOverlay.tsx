// 新手教程的遮罩和说明卡片，对应 iPad 版 Settings/TutorialTour.swift。
// 要圈出来的位置用元素上的 data-tour="名字" 找（iPad 版是 .tutorialAnchor）。
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { STChoice, rounded } from '../ui/kit'
import { SFIcon } from '../ui/SFIcon'
import { safeInsets, useCompact } from '../ui/compact'

export type Corner = 'topLeading' | 'topTrailing' | 'bottomLeading' | 'bottomTrailing'

export interface TourStep {
  /** 要圈出来的位置，可以圈好几个；空的话说明卡片放在屏幕中间 */
  targets?: string[]
  title: string
  lines: string[]
  /** 进入这一步前把演示小镇调成需要的样子 */
  prepare?: () => void
  /** 圈出来的地方可以真的点 */
  interactive?: boolean
  /** 整个屏幕都能点（比如要教“双击面板外面的空白处关掉”） */
  freeTaps?: boolean
  /** 动手的一步：做完自动进入下一步 */
  done?: () => boolean
  /** 点“帮我做”往后跳几步，按钮上写什么 */
  skipSteps?: number
  skipLabel?: string
  /** 圈出来的地方太大、旁边放不下时，指定说明卡片放在屏幕哪个角 */
  cardCorner?: Corner
  /** 手机上说明卡片停在哪（不填就自己挑挡得最少的位置） */
  phoneCard?: 'top' | 'middle' | 'bottom'
}

interface Rect { x: number; y: number; w: number; h: number }

/** 找第一个看得见的标记元素 */
function measure(id: string): Rect | null {
  const els = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return { x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 }
  }
  return null
}

const CARD_W = 380
const CARD_H = 330
const M = 20

/** 说明卡片放在圈出来的地方旁边；放不下就挑和圈出来的地方重叠最少的角落 */
function cardCenter(rects: Rect[], W: number, H: number): { x: number; y: number } {
  if (!rects.length) return { x: W / 2, y: H / 2 }
  const minX = Math.min(...rects.map((r) => r.x)); const maxX = Math.max(...rects.map((r) => r.x + r.w))
  const minY = Math.min(...rects.map((r) => r.y)); const maxY = Math.max(...rects.map((r) => r.y + r.h))
  const midX = (minX + maxX) / 2; const midY = (minY + maxY) / 2
  const cy = (y: number) => Math.min(Math.max(y, CARD_H / 2 + M), H - CARD_H / 2 - M)
  const cx = (x: number) => Math.min(Math.max(x, CARD_W / 2 + M), W - CARD_W / 2 - M)
  const candidates = [
    { x: maxX + M + CARD_W / 2, y: cy(midY) },
    { x: minX - M - CARD_W / 2, y: cy(midY) },
    { x: cx(midX), y: maxY + M + CARD_H / 2 },
    { x: cx(midX), y: minY - M - CARD_H / 2 },
    { x: CARD_W / 2 + M, y: CARD_H / 2 + M },
    { x: W - CARD_W / 2 - M, y: CARD_H / 2 + M },
    { x: CARD_W / 2 + M, y: H - CARD_H / 2 - M },
    { x: W - CARD_W / 2 - M, y: H - CARD_H / 2 - M },
  ]
  const overlap = (c: { x: number; y: number }) => {
    const l = c.x - CARD_W / 2; const t = c.y - CARD_H / 2
    if (l < M / 2 || t < M / 2 || l + CARD_W > W - M / 2 || t + CARD_H > H - M / 2) return Infinity
    return rects.reduce((sum, r) => {
      const iw = Math.min(l + CARD_W, r.x + r.w) - Math.max(l, r.x)
      const ih = Math.min(t + CARD_H, r.y + r.h) - Math.max(t, r.y)
      return sum + (iw > 0 && ih > 0 ? iw * ih : 0)
    }, 0)
  }
  return candidates.reduce((best, c) => (overlap(c) < overlap(best) ? c : best), candidates[0])
}

export function TourOverlay({ steps, onFinish }: { steps: TourStep[]; onFinish: () => void }) {
  const [index, setIndex] = useState(0)
  const [rects, setRects] = useState<Rect[]>([])
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  // 手机上卡片可以收成一行，免得挡住要点的地方
  const [mini, setMini] = useState(false)
  // 说明卡片的高度，手机上挑位置要用
  const [cardH, setCardH] = useState(260)
  const dragStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const doneAtEntry = useRef(false)
  const step = steps[index]
  const compact = useCompact()

  const go = useCallback((to: number) => {
    if (to < 0 || to >= steps.length) return
    steps[to].prepare?.()
    doneAtEntry.current = true
    // prepare 改的状态要等一下才生效，再看条件
    window.setTimeout(() => { doneAtEntry.current = steps[to].done?.() ?? false }, 500)
    setDrag({ x: 0, y: 0 })
    setMini(false)
    setIndex(to)
  }, [steps])

  useEffect(() => { steps[0].prepare?.() }, [steps])

  // 每 0.3 秒看一次“照着做”的步骤做完没有
  useEffect(() => {
    const t = window.setInterval(() => {
      const done = steps[index].done
      if (!done) return
      if (!done()) doneAtEntry.current = false
      else if (!doneAtEntry.current && index < steps.length - 1) go(index + 1)
    }, 300)
    return () => window.clearInterval(t)
  }, [index, steps, go])

  // 跟着界面动画一直量位置
  useLayoutEffect(() => {
    let raf = 0
    const tick = () => {
      const next = (step.targets ?? []).map(measure).filter((r): r is Rect => !!r)
      setRects((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
      setSize((prev) => (prev.w === window.innerWidth && prev.h === window.innerHeight ? prev : { w: window.innerWidth, h: window.innerHeight }))
      const h = cardRef.current?.offsetHeight
      if (h) setCardH((prev) => (prev === h ? prev : h))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [step])

  // 拦住圈出来的地方以外的点击和滑动：讲解的一步全部拦住，动手的一步只放行圈出来的地方。说明卡片总能点
  const cardRef = useRef<HTMLDivElement>(null)
  const live = useRef({ rects, interactive: !!step.interactive, free: !!step.freeTaps })
  live.current = { rects, interactive: !!step.interactive, free: !!step.freeTaps }
  useEffect(() => {
    const point = (e: Event): { x: number; y: number } | null => {
      if ('touches' in e) {
        const t = (e as TouchEvent).touches[0] ?? (e as TouchEvent).changedTouches[0]
        return t ? { x: t.clientX, y: t.clientY } : null
      }
      const m = e as MouseEvent
      return { x: m.clientX, y: m.clientY }
    }
    const allowed = (e: Event) => {
      const target = e.target as Node | null
      if (target && cardRef.current?.contains(target)) return true
      // 弹出的系统提示框（ui/Alert）在遮罩上面，总能点
      if (target instanceof Element && target.closest('[data-alert-host]')) return true
      if (live.current.free) return true
      if (!live.current.interactive) return false
      const p = point(e)
      if (!p) return true
      return live.current.rects.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)
    }
    // 一次手势（按下到抬起）按“按下的位置”决定放不放行，手指滑出圈出来的地方也不会把滑动打断
    let gestureAllowed = true
    const starts = new Set(['pointerdown', 'mousedown', 'touchstart'])
    const moves = new Set(['pointermove', 'touchmove', 'pointerup', 'mouseup', 'touchend', 'click', 'dblclick'])
    const block = (e: Event) => {
      let ok: boolean
      if (starts.has(e.type)) { ok = allowed(e); gestureAllowed = ok }
      else if (moves.has(e.type)) ok = gestureAllowed || allowed(e)
      else ok = allowed(e)
      if (ok) return
      e.stopPropagation()
      if (e.cancelable) e.preventDefault()
    }
    const types = ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'touchstart', 'touchmove', 'touchend', 'wheel']
    types.forEach((t) => window.addEventListener(t, block, { capture: true, passive: false }))
    return () => types.forEach((t) => window.removeEventListener(t, block, { capture: true }))
  }, [])

  const holes = rects.map((r) => {
    const rr = 14
    return `M${r.x + rr},${r.y} h${r.w - 2 * rr} a${rr},${rr} 0 0 1 ${rr},${rr} v${r.h - 2 * rr} a${rr},${rr} 0 0 1 -${rr},${rr} h-${r.w - 2 * rr} a${rr},${rr} 0 0 1 -${rr},-${rr} v-${r.h - 2 * rr} a${rr},${rr} 0 0 1 ${rr},-${rr} z`
  }).join(' ')
  const path = `M0,0 H${size.w} V${size.h} H0 Z ${holes}`
  const last = index === steps.length - 1

  let cardStyle: React.CSSProperties
  if (compact) {
    // 手机上卡片横跨整屏，停在上边或下边：圈出来的地方在下半屏就放上面，反过来放下面
    // 手机上卡片横跨整屏，上下挑一个挡住圈出来的地方最少的位置（贴顶、贴底、或者紧挨着圈出来的地方）
    const ch = cardH
    const inset = safeInsets()
    // 开着全屏面板时，不挡它的标题栏（关闭按钮在那里）
    const lo = 8 + inset.top + (document.querySelector('[data-mobile-page]') ? 58 : 0); const hi = Math.max(lo, size.h - ch - 8 - inset.bottom)
    const clamp = (y: number) => Math.min(Math.max(y, lo), hi)
    const covered = (y0: number) => rects.reduce((sum, r) => sum + Math.max(0, Math.min(y0 + ch, r.y + r.h) - Math.max(y0, r.y)) * r.w, 0)
    const candidates = step.phoneCard
      ? [step.phoneCard === 'top' ? lo : step.phoneCard === 'bottom' ? hi : clamp((size.h - ch) / 2 + 40)]
      : step.cardCorner
      ? [step.cardCorner.startsWith('top') ? lo : hi]
      : [lo, hi, ...rects.flatMap((r) => [clamp(r.y + r.h + 8), clamp(r.y - ch - 8)])]
    const y = candidates.reduce((best, c) => (covered(c) < covered(best) ? c : best), candidates[0])
    cardStyle = { position: 'absolute', left: 10, right: 10, top: y, transition: 'top .3s ease' }
  } else if (step.cardCorner) {
    const c = step.cardCorner
    cardStyle = {
      position: 'absolute',
      [c.startsWith('top') ? 'top' : 'bottom']: c.startsWith('top') ? 48 : M,
      [c.endsWith('Leading') ? 'left' : 'right']: M,
    }
  } else {
    const p = cardCenter(rects, size.w, size.h)
    cardStyle = { position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%, -50%)', transition: 'left .35s ease, top .35s ease' }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, pointerEvents: 'none' }}>
      <svg width={size.w} height={size.h} style={{ position: 'absolute', inset: 0 }}>
        {/* 遮罩：圈出来的地方挖空。动手的一步，挖空的地方能点到下面；讲解的一步全部拦住 */}
        {/* 遮罩只负责画；哪里能点由下面的 blockOutside 判断（Safari 对挖空的路径判断点击不可靠） */}
        <path d={path} fillRule="evenodd" fill={`rgba(0,0,0,${step.interactive ? 0.45 : 0.55})`} />
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={14} fill="none" stroke="var(--fabled)" strokeWidth={4} />
        ))}
      </svg>
      <div
        ref={cardRef}
        style={{ ...cardStyle, width: compact ? undefined : CARD_W, marginLeft: drag.x, marginTop: drag.y, pointerEvents: 'auto' }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          dragStart.current = { px: e.clientX, py: e.clientY, x: drag.x, y: drag.y }
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const s = dragStart.current
          if (s) setDrag({ x: s.x + e.clientX - s.px, y: s.y + e.clientY - s.py })
        }}
        onPointerUp={() => { dragStart.current = null }}
      >
        <div style={{
          display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12, padding: compact ? '12px 14px' : 20, background: 'var(--paper)',
          borderRadius: 18, outline: '3px solid var(--ink)', outlineOffset: -1.5, boxShadow: '0 6px 24px rgba(0,0,0,0.25)', color: 'var(--ink)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ ...rounded(14, 700), opacity: 0.5 }}>{index + 1} / {steps.length}</span>
            <span style={{ opacity: 0.35, marginLeft: 6 }}><SFIcon name="arrow.up.and.down.and.arrow.left.and.right" size={12} weight="bold" /></span>
            <span style={{ flex: 1 }} />
            {compact && mini ? null : <button onClick={onFinish} style={{ ...rounded(14, 700), opacity: 0.6 }}>退出教程</button>}
            {compact ? (
              <button onClick={() => setMini(!mini)} style={{ ...rounded(14, 800), marginLeft: 14, display: 'flex', alignItems: 'center', gap: 2, padding: '4px 0' }}>
                {mini ? '展开' : '收起'}
                <SFIcon name={mini ? 'chevron.down' : 'chevron.up'} size={14} weight="bold" />
              </button>
            ) : null}
          </div>
          {compact && mini ? <div style={{ ...rounded(16, 900), marginTop: -4 }}>{step.title}</div> : <>
          <div style={rounded(compact ? 19 : 24, 900)}>{step.title}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 5 : 8 }}>
            {step.lines.map((line, i) => <div key={i} style={{ ...rounded(compact ? 15 : 17), lineHeight: 'calc(1.2em + 3px)' /* .lineSpacing(3) */ }}>{line}</div>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ flex: 1 }} />
            {step.done ? (
              <>
                <span style={{ ...rounded(13, 600), opacity: 0.5 }}>{compact ? '照着做，做完自动下一步' : '照着做，完成后自动下一步'}</span>
                <STChoice selected={false} onClick={() => go(Math.min(index + (step.skipSteps ?? 1), steps.length - 1))}>
                  <span style={rounded(16, 700)}>{step.skipLabel ?? '帮我做'}</span>
                </STChoice>
              </>
            ) : (
              <STChoice selected onClick={() => (last ? onFinish() : go(index + 1))}>
                <span style={rounded(16, 700)}>{last ? '完成' : '下一步'}</span>
              </STChoice>
            )}
          </div>
          </>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

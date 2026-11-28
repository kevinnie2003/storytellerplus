// 几个弹出面板共用的小东西：背景、描边、iOS 的菜单式 Picker
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePress } from '../ui/gestures'
import { SFIcon } from '../ui/SFIcon'
import { useCompact } from '../ui/compact'

/** iOS 系统颜色 */
export const systemRed = 'light-dark(#ff3b30, #ff453a)'
export const systemGreen = 'light-dark(#34c759, #30d158)'
export const systemBlue = 'light-dark(#007aff, #0a84ff)'

/** .overlay(RoundedRectangle(cornerRadius: r).stroke(color, lineWidth: w))：描边压在边上，不占位置 */
export const stroke = (w: number, r: number, color = 'var(--ink)'): React.CSSProperties => ({
  borderRadius: r, outline: `${w}px solid ${color}`, outlineOffset: -w / 2,
})

type Edge = 'top' | 'bottom' | 'leading' | 'trailing'
/** 对应 Helpers/Border.swift 的 .border(width:edges:color:)：画在里面，不占位置 */
export const edgeBorder = (w: number, edges: Edge[], color = 'var(--ink)'): string =>
  edges.map((e) => {
    switch (e) {
      case 'top': return `inset 0 ${w}px 0 ${color}`
      case 'bottom': return `inset 0 -${w}px 0 ${color}`
      case 'leading': return `inset ${w}px 0 0 ${color}`
      case 'trailing': return `inset -${w}px 0 0 ${color}`
    }
  }).join(', ')

/** 小镇的安全区，和 screens/TownScreen.tsx 一样 */
export const SAFE_TOP = 32
export const SAFE_BOTTOM = 25

/** 盖满整个窗口的一层，没打开时什么都不画 */
export function OverlayLayer({ zIndex, children, onDoubleTapBackground, background, ignoresSafeArea = false }: {
  zIndex: number
  children: React.ReactNode
  onDoubleTapBackground?: () => void
  background: string
  /** 内容自己处理安全区（比如全屏的 ScrollView 自己留上下的空），按整个屏幕摆 */
  ignoresSafeArea?: boolean
}) {
  const press = usePress({ onDoubleTap: onDoubleTapBackground })
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'st-fade .3s ease-in-out', color: 'var(--ink)',
    }}>
      <div {...press} style={{ position: 'absolute', inset: 0, background }} />
      {/* iPad 上这些面板在 StoryTellerView 的安全区里居中（上 32、下 25），背景才铺满整屏 */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: ignoresSafeArea ? 0 : SAFE_TOP, bottom: ignoresSafeArea ? 0 : SAFE_BOTTOM, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ pointerEvents: 'auto', display: 'contents' }}>{children}</div>
      </div>
    </div>
  )
}

/** 面板高度：上下各留 50 */
export const panelHeight = 'calc(100% - 100px)'

/** .pickerStyle(.menu)：按钮显示选中的那项，点开是 iOS 的菜单 */
export function MenuPicker({ options, value, onChange, tint, style }: {
  options: { value: number; label: string }[]
  value: number
  onChange: (v: number) => void
  tint: string
  style?: React.CSSProperties
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const compact = useCompact()
  const current = options.find((o) => o.value === value)?.label ?? ''
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0, ...style }}>
      <button
        onClick={(e) => setAnchor(e.currentTarget)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, color: tint, fontSize: 17, minWidth: 0, maxWidth: '100%',
          fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif', padding: '6px 4px',
          // 手机上按钮至少 40 高，好点
          ...(compact ? { minHeight: 40 } : null),
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current}</span>
        <SFIcon name="chevron.up.chevron.down" size={14} weight="semibold" />
      </button>
      {anchor ? (
        <MenuPopup anchor={anchor} options={options} value={value} onPick={(v) => { setAnchor(null); onChange(v) }} onClose={() => setAnchor(null)} />
      ) : null}
    </div>
  )
}

function MenuPopup({ anchor, options, value, onPick, onClose }: {
  anchor: HTMLElement
  options: { value: number; label: string }[]
  value: number
  onPick: (v: number) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<React.CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const h = ref.current?.offsetHeight ?? 0
    const below = window.innerHeight - r.bottom - 12
    const above = r.top - 12
    // 窄屏上菜单变窄，左右都留 12，不出屏幕
    const w = Math.min(250, window.innerWidth - 24)
    const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12))
    if (h <= below || below >= above) setPos({ left, top: r.bottom + 6, maxHeight: below, width: w })
    else setPos({ left, bottom: window.innerHeight - r.top + 6, maxHeight: above, width: w })
  }, [anchor])
  useEffect(() => {
    const ref2 = ref.current
    if (!ref2) return
    const sel = ref2.querySelector('[data-selected="1"]') as HTMLElement | null
    sel?.scrollIntoView({ block: 'nearest' })
  }, [pos])
  return createPortal(
    <div
      data-alert-host
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 2500 }}
    >
      <div
        ref={ref}
        className="scroll-hidden"
        style={{
          // 网页版用 app 自己的样子，不模仿 iOS 的系统菜单
          position: 'fixed', width: 250, ...pos, overflowY: 'auto', borderRadius: 16,
          background: 'var(--paper)', border: '3px solid var(--ink)', boxShadow: '0 8px 24px rgba(0,0,0,0.22)', color: 'var(--ink)',
          fontFamily: 'var(--font-rounded)', fontWeight: 700, animation: 'st-fade .12s ease-out',
        }}
      >
        {options.map((o, i) => (
          <button
            key={o.value}
            data-selected={o.value === value ? '1' : undefined}
            onClick={() => onPick(o.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '11px 16px 11px 10px',
              fontSize: 17, textAlign: 'left',
              borderTop: i === 0 ? 'none' : '1.5px solid color-mix(in srgb, var(--ink) 20%, transparent)',
            }}
          >
            <span style={{ width: 22, display: 'flex', justifyContent: 'center' }}>
              {o.value === value ? <SFIcon name="checkmark" size={16} weight="semibold" /> : null}
            </span>
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

/** 转圈，对应 ProgressView() */
export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', display: 'block',
      border: `${Math.max(2, size / 9)}px solid rgba(128,128,128,0.3)`, borderTopColor: 'rgba(128,128,128,0.9)',
      animation: 'st-overlay-spin .8s linear infinite',
    }} />
  )
}

// 转圈动画的 keyframes（共用的 css 不归我管，这里自己插一条）
if (typeof document !== 'undefined' && !document.getElementById('st-overlay-keyframes')) {
  const el = document.createElement('style')
  el.id = 'st-overlay-keyframes'
  el.textContent = '@keyframes st-overlay-spin { to { transform: rotate(360deg) } }'
  document.head.appendChild(el)
}

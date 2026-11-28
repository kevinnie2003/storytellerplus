// 右侧 260 宽那一栏里几个面板共用的小零件
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CachedImage } from '../ui/CachedImage'
import { mono, rounded } from '../ui/kit'
import './panels.css'

/** 一排平分宽度的页签里的一格（文字变淡，边线不变淡） */
export function TabCell({ title, active, border, onTap, font = 'mono' }: {
  title: string
  active: boolean
  border: string
  onTap?: () => void
  font?: 'mono' | 'rounded'
}) {
  return (
    <div
      onClick={onTap}
      style={{
        flex: 1, minWidth: 0, padding: '10px 0', textAlign: 'center', boxShadow: border,
        cursor: onTap ? 'pointer' : undefined,
      }}
    >
      <span style={{
        ...(font === 'mono' ? mono(20, 700) : rounded(20, 700)),
        opacity: active ? 1 : 0.5, transition: 'opacity .3s ease-in-out', display: 'inline-block',
      }}>{title}</span>
    </div>
  )
}

/** ——— 文字 ——— 这样的分隔 */
export function LabeledDivider({ title, style }: { title: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', ...style }}>
      <div style={{ flex: 1, height: 2, background: 'var(--ink)' }} />
      <span style={{ ...mono(20, 700), whiteSpace: 'nowrap' }}>{title}</span>
      <div style={{ flex: 1, height: 2, background: 'var(--ink)' }} />
    </div>
  )
}

/** 图标 + 标题 + 说明的一行（相克、提名相关角色等列表） */
export function IconTextRow({ imageURL, showImage = true, title, text, style }: {
  imageURL: string
  showImage?: boolean
  title: string
  text: string
  style?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 5px', width: '100%', ...style }}>
      {showImage ? <CachedImage url={imageURL} size={40} /> : <div style={{ width: 40, height: 40, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ ...rounded(20, 700), color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{title}</div>
        <div style={{ ...rounded(15, 600), color: 'color-mix(in srgb, var(--ink) 80%, transparent)' }}>{text}</div>
      </div>
    </div>
  )
}

/** SwiftUI ScrollView：内容是一列，默认间距 8，横向居中 */
export function ScrollColumn({ children, style, hideIndicators = true }: {
  children: React.ReactNode
  style?: React.CSSProperties
  hideIndicators?: boolean
}) {
  return (
    <div className={hideIndicators ? 'scroll-hidden' : undefined} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', ...style }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

/**
 * .transition(.move(edge: .trailing)) + .animation(value:)：换内容时新的从右边滑进来，旧的往右边滑出去
 */
export function SlideSwitch({ value, children }: { value: number; children: React.ReactNode }) {
  const [out, setOut] = useState<{ key: number; node: React.ReactNode } | null>(null)
  const [switched, setSwitched] = useState(false)
  const last = useRef<{ key: number; node: React.ReactNode }>({ key: value, node: children })
  // 先用上一次记下的旧内容做退场，再记下这次的
  useLayoutEffect(() => {
    if (last.current.key === value) return
    setOut(last.current)
    setSwitched(true)
  }, [value])
  useLayoutEffect(() => { last.current = { key: value, node: children } })
  useEffect(() => {
    if (!out) return
    const t = window.setTimeout(() => setOut(null), 300)
    return () => window.clearTimeout(t)
  }, [out])

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', overflow: 'hidden' }}>
      {out && out.key !== value ? (
        <div key={`out-${out.key}`} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', animation: 'st-panel-out .3s ease-in-out forwards', pointerEvents: 'none' }}>
          {out.node}
        </div>
      ) : null}
      <div key={`in-${value}`} style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        animation: switched ? 'st-panel-in .3s ease-in-out' : undefined,
      }}>
        {children}
      </div>
    </div>
  )
}

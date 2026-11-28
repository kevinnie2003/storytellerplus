// 设置、存档、开始页共用的小组件，对应 iPad 版 Settings/STStyle.swift
import { SFIcon } from './SFIcon'
import { useCompact } from './compact'

/**
 * iPad 上 .rounded / .monospaced 的 .semibold 遇到汉字时，实际画出来只有苹方 Medium 那么粗
 * （和模拟器截图逐字比过），网页上直接用 600 会粗一截，所以 600 一律按 500 画
 */
const cjkWeight = (weight: number | string) => (weight === 600 || weight === '600' ? 500 : weight) as React.CSSProperties['fontWeight']

/**
 * 字距和中文字的大小，都是对着模拟器截图逐字量出来的：
 * - 20 号以下：中文就是苹方原大小，字距按 Apple 的 tracking 表（每个字收 0.2–0.4）。
 * - 20 号起系统字体换成 Display 字形，后备的苹方画小到约 92%，但字距反而放宽约 0.5。
 *   所以 20 号以上用 --font-*-display（那里的中文字体带 size-adjust: 92%），字距 +0.5。
 * 这样一行排几个字、在哪里换行都和 iPad 一样
 */
const TRACKING: Record<number, number> = {
  10: 0.12, 11: 0.06, 12: 0, 13: -0.08, 14: -0.15, 15: -0.18, 16: -0.31, 17: -0.43, 18: -0.44, 19: -0.45,
}
const DISPLAY_FROM = 20
export const tracking = (size: number): number => {
  const s = Math.round(size)
  if (s < 10) return 0.12
  if (s >= DISPLAY_FROM) return 0.5
  return TRACKING[s] ?? 0
}

export const rounded = (size: number, weight: number | string = 400): React.CSSProperties => ({
  fontFamily: size >= DISPLAY_FROM ? 'var(--font-rounded-display)' : 'var(--font-rounded)',
  fontSize: size, fontWeight: cjkWeight(weight), letterSpacing: tracking(size),
})
export const mono = (size: number, weight: number | string = 400): React.CSSProperties => ({
  fontFamily: size >= DISPLAY_FROM ? 'var(--font-mono-display)' : 'var(--font-mono)', fontSize: size, fontWeight: cjkWeight(weight),
})
/** SwiftUI 字重：.semibold 600 .bold 700 .heavy 800 .black 900 */

export function STSection({ title, children }: { title: string; children: React.ReactNode }) {
  const compact = useCompact()
  // 手机上标题和框里的留白都小一号
  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={rounded(20, 900)}>{title}</div>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 18, padding: 13, minWidth: 0,
          background: 'var(--paper)', borderRadius: 16, border: '3px solid var(--ink)',
        }}>
          {children}
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={rounded(24, 900)}>{title}</div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 22, padding: 17, /* 20 - 描边 3 */
        background: 'var(--paper)', borderRadius: 18, border: '3px solid var(--ink)',
      }}>
        {children}
      </div>
    </div>
  )
}

export function STRow({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  const compact = useCompact()
  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={rounded(17, 700)}>{title}</div>
          {hint ? <div style={{ ...rounded(14), opacity: 0.55 }}>{hint}</div> : null}
        </div>
        {children}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={rounded(19, 700)}>{title}</div>
        {hint ? <div style={{ ...rounded(15), opacity: 0.55 }}>{hint}</div> : null}
      </div>
      {children}
    </div>
  )
}

export function STChoice({ selected, onClick, children, disabled, style }: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        color: selected ? 'var(--paper)' : 'var(--ink)',
        background: selected ? 'var(--ink)' : 'transparent',
        padding: '7.5px 13.5px', borderRadius: 14, border: '2.5px solid var(--ink)', /* 10/16 - 描边 2.5 */
        transition: 'background .15s, color .15s', opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function STChoiceRow<T>({ options, value, onChange }: {
  options: [T, string][]
  value: T
  onChange: (v: T) => void
}) {
  const compact = useCompact()
  return (
    <div style={{ display: 'flex', gap: compact ? 8 : 10, flexWrap: 'wrap' }}>
      {options.map(([v, label], i) => (
        <STChoice key={i} selected={v === value} onClick={() => onChange(v)}>
          <span style={rounded(compact ? 16 : 17, 700)}>{label}</span>
        </STChoice>
      ))}
    </div>
  )
}

export function STBigButton({ title, subtitle, systemImage, filled, onClick, style }: {
  title: string
  subtitle?: string
  systemImage?: string
  filled?: boolean
  onClick: () => void
  style?: React.CSSProperties
}) {
  const compact = useCompact()
  if (compact) {
    // 手机上矮一点、字小一号
    return (
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60,
          padding: '8px 14px', textAlign: 'left',
          color: filled ? 'var(--paper)' : 'var(--ink)',
          background: filled ? 'var(--ink)' : 'var(--paper)',
          borderRadius: 16, border: '3px solid var(--ink)',
          ...style,
        }}
      >
        {systemImage ? <span style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}><SFIcon name={systemImage} size={22} weight="bold" /></span> : null}
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          <span style={rounded(19, 900)}>{title}</span>
          {subtitle ? <span style={{ ...rounded(14), opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span> : null}
        </span>
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 72,
        padding: '9px 17px', textAlign: 'left', /* 12/20 - 描边 3 */
        color: filled ? 'var(--paper)' : 'var(--ink)',
        background: filled ? 'var(--ink)' : 'var(--paper)',
        borderRadius: 18, border: '3px solid var(--ink)',
        ...style,
      }}
    >
      {systemImage ? <span style={{ width: 32, display: 'flex', justifyContent: 'center' }}><SFIcon name={systemImage} size={24} weight="bold" /></span> : null}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
        <span style={rounded(21, 900)}>{title}</span>
        {subtitle ? <span style={{ ...rounded(15), opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span> : null}
      </span>
    </button>
  )
}

export function STPageHeader({ title, onClose, closeLabel = '完成' }: { title: string; onClose: () => void; closeLabel?: string }) {
  const compact = useCompact()
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ ...rounded(22, 900), flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <button
          onClick={onClose}
          style={{ ...rounded(16, 900), color: 'var(--paper)', background: 'var(--ink)', padding: '0 18px', height: 38, borderRadius: 999, flexShrink: 0 }}
        >{closeLabel}</button>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={rounded(34, 900)}>{title}</div>
      <div style={{ flex: 1 }} />
      <button
        onClick={onClose}
        style={{ ...rounded(19, 900), color: 'var(--paper)', background: 'var(--ink)', padding: '10px 22px', borderRadius: 999 }}
      >{closeLabel}</button>
    </div>
  )
}

/** 粗黑描边的圆角框，很多面板都这样。注意：SwiftUI 的描边不占尺寸，CSS 的 border 占，内边距要减掉描边宽度 */
export const panel = (radius = 10, line = 3): React.CSSProperties => ({
  background: 'var(--mainbg)', borderRadius: radius, border: `${line}px solid var(--ink)`, overflow: 'hidden',
})

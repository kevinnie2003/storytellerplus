// 手机上的全屏面板：顶上标题和关闭按钮，下面是内容。小镇里的弹出面板在手机上都套这个
import { createPortal } from 'react-dom'
import { SFIcon } from '../ui/SFIcon'
import { rounded } from '../ui/kit'

export function MobilePage({ title, onClose, zIndex = 100, right, children, scroll = true, background = 'var(--mainbg)', bodyStyle }: {
  title: React.ReactNode
  onClose: () => void
  zIndex?: number
  /** 标题栏右边、关闭按钮左边的按钮 */
  right?: React.ReactNode
  children: React.ReactNode
  /** 内容自己管滚动时传 false */
  scroll?: boolean
  background?: string
  bodyStyle?: React.CSSProperties
}) {
  return createPortal(
    <div
      data-mobile-page
      style={{
        position: 'fixed', inset: 0, zIndex, background, color: 'var(--ink)', display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)', animation: 'st-rise .25s cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <MobileHeader title={title} onClose={onClose} right={right} />
      {/* 外层负责滚动，里面一列不会被压扁 */}
      <div
        className={scroll ? 'scroll-hidden' : undefined}
        style={{ flex: 1, minHeight: 0, overflowY: scroll ? 'auto' : 'hidden', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{
          display: 'flex', flexDirection: 'column', flex: scroll ? '1 0 auto' : '1 1 0', minHeight: scroll ? undefined : 0,
          paddingBottom: scroll ? 'calc(16px + env(safe-area-inset-bottom))' : 'env(safe-area-inset-bottom)',
          ...bodyStyle,
        }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function MobileHeader({ title, onClose, right }: { title: React.ReactNode; onClose?: () => void; right?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 10px 16px', flexShrink: 0,
      borderBottom: '3px solid var(--ink)',
    }}>
      <div style={{ ...rounded(20, 900), flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{title}</div>
      {right}
      {onClose ? <CloseButton onClick={onClose} /> : null}
    </div>
  )
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="关闭"
      onClick={onClick}
      style={{
        width: 38, height: 38, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mainbg)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <SFIcon name="xmark" size={22} weight="bold" />
    </button>
  )
}

/** 标题栏里的小按钮（图标 + 字） */
export function HeaderButton({ icon, label, onClick, disabled }: { icon?: string; label?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, height: 38, padding: label ? '0 12px' : 0, width: label ? undefined : 38,
        justifyContent: 'center', borderRadius: 19, border: '2.5px solid var(--ink)', color: 'var(--ink)', flexShrink: 0,
        opacity: disabled ? 0.35 : 1, ...rounded(15, 800),
      }}
    >
      {icon ? <SFIcon name={icon} size={18} weight="bold" /> : null}
      {label ? <span>{label}</span> : null}
    </button>
  )
}

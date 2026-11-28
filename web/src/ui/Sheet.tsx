// SwiftUI 的 .sheet（iPad 上的 page 样式）：屏幕中间一张大卡片，背后变暗。点外面不关闭，和 iPad 一样要点“完成”
import { createPortal } from 'react-dom'

export function Sheet({ open, onClose, children, dismissOnBackdrop = false, width, height }: {
  open: boolean
  onClose?: () => void
  children: React.ReactNode
  dismissOnBackdrop?: boolean
  width?: number | string
  height?: number | string
}) {
  if (!open) return null
  return createPortal(
    <div
      onPointerDown={(e) => { if (dismissOnBackdrop && e.target === e.currentTarget) onClose?.() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--sheetdim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'st-fade .2s ease-out',
      }}
    >
      <div
        style={{
          width: width ?? 'min(calc(100vw - 48px), max(77.4vw, 600px))',
          height: height ?? 'min(calc(100vh - 48px), 81vh)',
          // 模拟器里量的：大弹窗比正中间高 5（上 74、下 750）
          position: 'relative', top: -5,
          background: 'var(--mainbg)', color: 'var(--ink)', borderRadius: 34, overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column',
          animation: 'st-rise .28s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** 全屏盖住，对应 .fullScreenCover */
export function FullScreen({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'var(--mainbg)', animation: 'st-rise .28s ease-out' }}>
      {children}
    </div>,
    document.body,
  )
}

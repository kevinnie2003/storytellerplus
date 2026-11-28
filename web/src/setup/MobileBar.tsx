// 手机上配版每一页底下的操作条：上面一行是数量，下面一排按钮，贴着底部安全区
import { rounded } from '../ui/kit'

export function MobileBar({ status, accessory, panel, buttonsTour, children }: {
  /** 左边的数量、提示 */
  status?: React.ReactNode
  /** 右边的小按钮 */
  accessory?: React.ReactNode
  /** 展开的内容，放在按钮上面 */
  panel?: React.ReactNode
  buttonsTour?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 2,
      background: 'var(--mainbg)', borderTop: '3px solid var(--ink)', borderRadius: '18px 18px 0 0',
      boxShadow: '0 -4px 14px rgba(0,0,0,0.12)', padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
    }}>
      {status || accessory ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
          <div style={{ ...rounded(16, 800), flex: 1, minWidth: 0, lineHeight: 1.25 }}>{status}</div>
          {accessory}
        </div>
      ) : null}
      {panel}
      <div data-tour={buttonsTour} style={{ display: 'flex', gap: 8 }}>{children}</div>
    </div>
  )
}

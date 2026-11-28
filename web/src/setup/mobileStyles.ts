// 手机版配版页共用的样式
import { rounded } from '../ui/kit'

/** 操作条上的按钮，primary 是实心的那个 */
export const barButton = (primary = false): React.CSSProperties => ({
  ...rounded(17, 800), flex: '1 1 0', minWidth: 0, height: 48, borderRadius: 14, border: '3px solid var(--ink)',
  background: primary ? 'var(--ink)' : 'var(--mainbg)', color: primary ? 'var(--mainbg)' : 'var(--ink)', whiteSpace: 'nowrap',
})

/** 手机上可以滚的内容区 */
export const phoneScroll: React.CSSProperties = {
  flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
  display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 12px 24px',
}

/** 手机上的小字说明 */
export const phoneHint: React.CSSProperties = { ...rounded(14, 600), lineHeight: 1.4, color: 'color-mix(in srgb, var(--ink) 65%, transparent)' }

// SwiftUI 的 .alert 和 .confirmationDialog。用法：showAlert({ title, message, buttons })
import { create } from 'zustand'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { rounded } from './kit'
import { useCompact } from './compact'

export interface AlertButton {
  label: string
  role?: 'cancel' | 'destructive'
  action?: () => void
}

export interface AlertSpec {
  title: string
  message?: string
  buttons?: AlertButton[]
  /** 有输入框的提示（例如自定义倒计时） */
  input?: { placeholder?: string; value: string; inputMode?: 'decimal' | 'text' }
  /** confirmationDialog：按钮竖着排，从下面弹出 */
  sheet?: boolean
  /** iPad 上 confirmationDialog 是从触发它的那一块弹出的气泡（popover）：给出那一块的元素，就按气泡画 */
  anchor?: HTMLElement | null
}

interface AlertStore {
  current: (AlertSpec & { id: number }) | null
  queue: (AlertSpec & { id: number })[]
  inputValue: string
}

const useAlerts = create<AlertStore>(() => ({ current: null, queue: [], inputValue: '' }))
let nextId = 1

export function showAlert(spec: AlertSpec) {
  const item = { ...spec, id: nextId++ }
  const s = useAlerts.getState()
  if (s.current) useAlerts.setState({ queue: [...s.queue, item] })
  else useAlerts.setState({ current: item, inputValue: spec.input?.value ?? '' })
}

/** 有输入框的提示里，按钮可以用这个读到输入的内容 */
// 按下按钮时先记下输入的内容，close() 会清空输入框
let submittedInput = ''
export const alertInputValue = () => submittedInput

function close() {
  const s = useAlerts.getState()
  const [next, ...rest] = s.queue
  useAlerts.setState({ current: next ?? null, queue: rest, inputValue: next?.input?.value ?? '' })
}

export function AlertHost() {
  const current = useAlerts((s) => s.current)
  const inputValue = useAlerts((s) => s.inputValue)
  const compact = useCompact()
  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current])
  if (!current) return null
  const buttons = current.buttons?.length ? current.buttons : [{ label: '好', role: 'cancel' as const }]
  const press = (b: AlertButton) => { submittedInput = useAlerts.getState().inputValue; close(); b.action?.() }
  const vertical = current.sheet || buttons.length > 2
  // iOS 把取消放在最后（竖排）或者最左（横排）
  const ordered = vertical
    ? [...buttons.filter((b) => b.role !== 'cancel'), ...buttons.filter((b) => b.role === 'cancel')]
    : [...buttons.filter((b) => b.role === 'cancel'), ...buttons.filter((b) => b.role !== 'cancel')]
  // 手机上 confirmationDialog 一律从底下弹出（气泡放不下）
  if (current.sheet && compact) {
    return createPortal(<ActionSheet spec={current} buttons={buttons} press={press} />, document.body)
  }
  if (current.sheet && current.anchor) {
    return createPortal(<Popover spec={current} buttons={buttons} press={press} />, document.body)
  }
  // 网页版的提示框用 app 自己的样子（奶油色卡片、粗黑描边、圆角按钮），不模仿 iOS 系统弹窗
  return createPortal(
    <div data-alert-host style={{
      position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--sheetdim)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'st-fade .15s ease-out',
    }}>
      <div className={compact ? 'scroll-hidden' : undefined} style={{
        width: 360, maxWidth: 'calc(100vw - 32px)', background: 'var(--paper)', color: 'var(--ink)',
        borderRadius: 20, border: '3px solid var(--ink)', padding: 22,
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 10,
        animation: 'st-pop .2s ease-out',
        // 手机上字多了也不出屏幕，长字会折行
        ...(compact ? { padding: 18, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', overflowWrap: 'anywhere' } : null),
      }}>
        <div style={rounded(21, 900)}>{current.title}</div>
        {current.message ? <div style={{ ...rounded(16), lineHeight: 1.4, opacity: 0.75, whiteSpace: 'pre-wrap' }}>{current.message}</div> : null}
        {current.input ? (
          <input
            autoFocus
            value={inputValue}
            inputMode={current.input.inputMode}
            placeholder={current.input.placeholder}
            onChange={(e) => useAlerts.setState({ inputValue: e.target.value })}
            onKeyDown={(e) => {
              const main = ordered.find((b) => b.role !== 'cancel')
              if (e.key === 'Enter' && main) press(main)
            }}
            style={{
              ...rounded(18, 600), marginTop: 4, padding: '9.5px 13.5px', borderRadius: 12,
              border: '2.5px solid var(--ink)', outline: 'none', background: 'var(--mainbg)',
            }}
          />
        ) : null}
        <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: 10, marginTop: 8, flexWrap: compact && !vertical ? 'wrap' : undefined, flexShrink: 0 }}>
          {ordered.map((b, i) => <AlertButtonView key={i} button={b} onClick={() => press(b)} wrap={compact && !vertical} />)}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** 提示框里的按钮：取消是描边的，其他是黑底的，危险操作是红底的 */
function AlertButtonView({ button, onClick, full, wrap }: {
  button: AlertButton
  onClick: () => void
  full?: boolean
  /** 横排按钮放不下时换行：按字的宽度排，一行放不下就自己占一行 */
  wrap?: boolean
}) {
  const cancel = button.role === 'cancel'
  const danger = button.role === 'destructive'
  return (
    <button
      onClick={onClick}
      style={{
        ...rounded(17, 700), flex: full ? undefined : 1, width: full ? '100%' : undefined,
        padding: '9.5px 14px', borderRadius: 14, border: `2.5px solid ${danger ? 'var(--warningRed)' : 'var(--ink)'}`,
        background: cancel ? 'transparent' : danger ? 'var(--warningRed)' : 'var(--ink)',
        color: cancel ? 'var(--ink)' : danger ? '#f6f1e2' : 'var(--paper)',
        ...(wrap ? { flex: '1 1 auto', minHeight: 44 } : null),
      }}
    >{button.label}</button>
  )
}

/**
 * iPad 的 confirmationDialog：从触发的那一块旁边弹出的气泡。不压暗背景、不显示标题，
 * 也没有“取消”按钮（点气泡外面就是取消）。尺寸照模拟器量的：宽 285，按钮高 45、间距 11、四周 15
 */
function Popover({ spec, buttons, press }: {
  spec: AlertSpec
  buttons: AlertButton[]
  press: (b: AlertButton) => void
}) {
  const rect = spec.anchor!.getBoundingClientRect()
  const width = 285
  const shown = buttons.filter((b) => b.role !== 'cancel')
  const cancel = buttons.find((b) => b.role === 'cancel')
  const height = 15 + (spec.message ? 69 : 0) + shown.length * 45 + Math.max(0, shown.length - 1) * 11 + 15
  const margin = 12
  // 左边放得下就放左边，箭头朝右指着那一块；放不下就放右边
  const onLeft = rect.left - width - 10 >= margin
  const left = onLeft ? rect.left - width - 8 : rect.right + 8
  const centerY = rect.top + rect.height / 2
  const top = Math.min(Math.max(centerY - height / 2, margin), window.innerHeight - height - margin)
  return (
    <div data-alert-host style={{ position: 'fixed', inset: 0, zIndex: 3000 }}>
      <div style={{ position: 'absolute', inset: 0 }} onClick={() => press(cancel ?? { label: '' })} />
      <div style={{
        position: 'absolute', left, top, width, animation: 'st-fade .15s ease-out',
        display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 18,
        background: 'var(--paper)', color: 'var(--ink)', border: '3px solid var(--ink)', boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
      }}>
        {spec.message ? <div style={{ ...rounded(15), opacity: 0.75, lineHeight: 1.35, padding: '2px 4px' }}>{spec.message}</div> : null}
        {shown.map((b, i) => <AlertButtonView key={i} button={{ ...b, role: b.role === 'destructive' ? 'destructive' : 'cancel' }} onClick={() => press(b)} full />)}
      </div>
    </div>
  )
}

/** 手机上的 confirmationDialog：从底下弹出的一列按钮，最下面单独一个取消 */
function ActionSheet({ spec, buttons, press }: {
  spec: AlertSpec
  buttons: AlertButton[]
  press: (b: AlertButton) => void
}) {
  const shown = buttons.filter((b) => b.role !== 'cancel')
  const cancel = buttons.find((b) => b.role === 'cancel') ?? { label: '取消', role: 'cancel' as const }
  return (
    <div data-alert-host style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--sheetdim)', animation: 'st-fade .15s ease-out' }}>
      <div style={{ position: 'absolute', inset: 0 }} onClick={() => press(cancel)} />
      <div style={{
        position: 'absolute', left: 8, right: 8, bottom: 'calc(8px + env(safe-area-inset-bottom))',
        maxHeight: 'calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', gap: 8, animation: 'st-rise .22s cubic-bezier(.2,.8,.2,1)',
      }}>
        <div className="scroll-hidden" style={{
          minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 20,
          background: 'var(--paper)', color: 'var(--ink)', border: '3px solid var(--ink)', boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
          overflowWrap: 'anywhere',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 4px', textAlign: 'center', flexShrink: 0 }}>
            <div style={rounded(17, 900)}>{spec.title}</div>
            {spec.message ? <div style={{ ...rounded(14), opacity: 0.75, lineHeight: 1.35 }}>{spec.message}</div> : null}
          </div>
          {shown.map((b, i) => (
            <div key={i} style={{ flexShrink: 0, display: 'flex' }}>
              <AlertButtonView button={{ ...b, role: b.role === 'destructive' ? 'destructive' : 'cancel' }} onClick={() => press(b)} full />
            </div>
          ))}
        </div>
        <div style={{ flexShrink: 0, display: 'flex' }}>
          <AlertButtonView button={{ label: cancel.label }} onClick={() => press(cancel)} full />
        </div>
      </div>
    </div>
  )
}

// 屏幕底部的撤销提示，对应 iPad 版 Town/TownActions.swift 里的 UndoToast
import { performUndo, useUndo } from '../game/undo'
import { rounded } from '../ui/kit'

export function UndoToast() {
  const message = useUndo((s) => s.message)
  const token = useUndo((s) => s.token)
  if (!message) return null
  return (
    <div
      key={token}
      style={{
        display: 'flex', alignItems: 'center', gap: 18, padding: '8px 8px 8px 22px', background: 'var(--ink)',
        borderRadius: 999, animation: 'st-toast-in .2s ease-out',
      }}
    >
      <span style={{ ...rounded(18, 700), color: 'var(--paper)', lineHeight: 1.2 }}>{message}</span>
      <button
        onClick={performUndo}
        style={{ ...rounded(18, 900), color: 'var(--ink)', padding: '7px 16px', background: 'var(--paper)', borderRadius: 999, lineHeight: 1.2 }}
      >撤销</button>
    </div>
  )
}

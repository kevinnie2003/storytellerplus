// 屏幕底部的“撤销”：最近一次操作，5 秒内可以撤销。对应 iPad 版 UndoCenter
import { create } from 'zustand'
import { settings } from '../settings/store'

interface UndoState { message: string | null; action: (() => void) | null; token: number }

export const useUndo = create<UndoState>(() => ({ message: null, action: null, token: 0 }))

export function registerUndo(message: string, undo: () => void) {
  if (!settings().undoEnabled) return
  const token = useUndo.getState().token + 1
  useUndo.setState({ message, action: undo, token })
  window.setTimeout(() => {
    if (useUndo.getState().token === token) clearUndo()
  }, 5000)
}

export function performUndo() {
  useUndo.getState().action?.()
  clearUndo()
}

export function clearUndo() {
  useUndo.setState({ message: null, action: null })
}

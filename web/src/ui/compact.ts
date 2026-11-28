// 手机布局开关：屏幕窄（竖着的手机）或者矮（横着的手机）时用手机版界面，iPad 和电脑上不变
import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 699px), (max-height: 499px)'
const mq = typeof window !== 'undefined' ? window.matchMedia(QUERY) : null

export const isCompact = () => mq?.matches ?? false

const subscribe = (cb: () => void) => {
  mq?.addEventListener('change', cb)
  return () => mq?.removeEventListener('change', cb)
}

export function useCompact(): boolean {
  return useSyncExternalStore(subscribe, isCompact, () => false)
}

/** 手机的安全区（刘海、底部横条） */
export const safeTop = 'env(safe-area-inset-top)'
export const safeBottom = 'env(safe-area-inset-bottom)'

/** 读出安全区的像素值：放一个看不见的元素量它的内边距 */
let probe: HTMLDivElement | null = null
export function safeInsets(): { top: number; bottom: number } {
  if (!probe) {
    probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
    document.body.appendChild(probe)
  }
  const st = getComputedStyle(probe)
  return { top: parseFloat(st.paddingTop) || 0, bottom: parseFloat(st.paddingBottom) || 0 }
}

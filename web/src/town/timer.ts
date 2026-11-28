// 计时器的状态：游戏时长、白天/夜晚时长、计时器。放在组件外面，
// 1. 手机和大屏布局来回切换时不会清零
// 2. 说书人联机要把它同步到玩家手机上（net/host.ts）
import { create } from 'zustand'

export const timerState = {
  /** 这些时间属于哪一局；换了一局才重新开始算 */
  gameID: '',
  gameStartTime: Date.now(),
  dayTimeStart: Date.now(),
  nightTimeStart: Date.now(),
  timerTimeStart: Date.now(),
  previousTimerElapsed: 0,
  timerStopped: true,
}

/** 计时器有变化（开始、暂停、归零、换白天黑夜）时加一，用来通知别人 */
export const useTimerVersion = create(() => ({ v: 0 }))
export const bumpTimer = () => useTimerVersion.setState((s) => ({ v: s.v + 1 }))

/** 计时器现在走了几秒 */
export function timerElapsedNow(at = Date.now()): number {
  const t = timerState
  return t.timerStopped ? t.previousTimerElapsed : t.previousTimerElapsed + Math.ceil((at - t.timerTimeStart) / 1000)
}

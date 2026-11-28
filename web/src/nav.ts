// 开始页和小镇之间的切换，对应 iPad 版 ContentView 的 viewNumber / loadLast / jsonArray。
// 单独放一个文件：改 App.tsx 时热更新不会把这里的状态清掉
import { create } from 'zustand'

export interface AppNav {
  /** 0 开始页，1 小镇 */
  viewNumber: number
  /** 进小镇时载入上一局存档，而不是读新剧本 */
  loadLast: boolean
  /** 新开一局时的剧本 JSON */
  playJSON: Record<string, unknown>[]
  /** 新手教程的演示小镇：不存档，界面上盖一层教程 */
  demo: boolean
}

export const useNav = create<AppNav>(() => ({ viewNumber: 0, loadLast: false, playJSON: [], demo: false }))

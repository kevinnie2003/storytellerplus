// 手机版小镇自己的界面状态：信息页开没开、流程面板拉没拉起来。放在外面，新手教程也能控制
import { create } from 'zustand'

export const useMobileUI = create<{ info: boolean; sheetExpanded: boolean }>(() => ({ info: false, sheetExpanded: false }))
export const setMobileUI = (patch: Partial<{ info: boolean; sheetExpanded: boolean }>) => useMobileUI.setState(patch)

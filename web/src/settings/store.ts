// 设置，对应 iPad 版 AppSettings 以及几个 @AppStorage；存在浏览器 localStorage，键名和 iPad 版一致
import { create } from 'zustand'

export const defaultNotepadTags: string[] = [
  '你是', '他是', '是', '活着', '死亡', '邪恶', '善良',
  '镇民', '外来者', '爪牙', '旅行者', '恶魔', '中毒', '醉酒', '你被', '洗脑',
  '使用能力吗', '共边', '不共边', '左边', '右边', '不能说', '不可以', '不建议', '请选择', '选择', '?',
]

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 隐私模式等写不进去就算了 */ }
}

export interface Settings {
  /** light 浅色、dark 深色、game 跟随游戏昼夜 */
  appearance: 'light' | 'dark' | 'game'
  /** 小镇里现在是不是夜晚，跟随昼夜用，不存 */
  gameIsNight: boolean
  cardsPerRow: number
  cardFontScale: number
  confirmDeath: boolean
  undoEnabled: boolean
  circleLayout: boolean
  defaultPlayerCount: number
  notepadTags: string[]
  houseRules: string
  savantBatchTotal: number
  savantBatchTrue: number
  hideTeamColors: boolean
  tutorialSeen: boolean
  countdownSeconds: number
  set: <K extends keyof Omit<Settings, 'set'>>(key: K, value: Settings[K]) => void
}

const keys: Record<string, string> = {
  appearance: 'settings.appearance',
  cardsPerRow: 'settings.cardsPerRow',
  cardFontScale: 'settings.cardFontScale',
  confirmDeath: 'settings.confirmDeath',
  undoEnabled: 'settings.undoEnabled',
  circleLayout: 'settings.circleLayout',
  defaultPlayerCount: 'settings.defaultPlayerCount',
  notepadTags: 'settings.notepadTags',
  houseRules: 'settings.houseRules',
  savantBatchTotal: 'settings.savantBatchTotal',
  savantBatchTrue: 'settings.savantBatchTrue',
  hideTeamColors: 'hideTeamColors',
  tutorialSeen: 'tutorial.seen',
  countdownSeconds: 'timer.countdownSeconds',
}

export const useSettings = create<Settings>((set) => ({
  appearance: read('settings.appearance', 'game'),
  gameIsNight: false,
  cardsPerRow: read('settings.cardsPerRow', 3),
  cardFontScale: read('settings.cardFontScale', 1.0),
  confirmDeath: read('settings.confirmDeath', true),
  undoEnabled: read('settings.undoEnabled', true),
  circleLayout: read('settings.circleLayout', false),
  defaultPlayerCount: read('settings.defaultPlayerCount', 0),
  notepadTags: read('settings.notepadTags', defaultNotepadTags),
  houseRules: read('settings.houseRules', ''),
  savantBatchTotal: read('settings.savantBatchTotal', 14),
  savantBatchTrue: read('settings.savantBatchTrue', 8),
  hideTeamColors: read('hideTeamColors', false),
  tutorialSeen: read('tutorial.seen', false),
  countdownSeconds: read('timer.countdownSeconds', 0),
  set: (key, value) => {
    if (keys[key as string]) write(keys[key as string], value)
    set({ [key]: value } as never)
  },
}))

export const settings = () => useSettings.getState()

/** 现在该用深色吗 */
export function isDarkNow(s: Pick<Settings, 'appearance' | 'gameIsNight'>): boolean {
  return s.appearance === 'dark' || (s.appearance === 'game' && s.gameIsNight)
}

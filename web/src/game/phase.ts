// 现在是第几天、第几夜：数记录里的“白天”“夜晚”
import type { GameLogEntry } from './types'

export function phaseLabel(gameState: number, allLogs: GameLogEntry[]): string {
  if (gameState === 0) return '配版'
  if (gameState === 1) return '第一夜'
  if (gameState === 2) return `第${Math.max(1, allLogs.filter((l) => l.type === 10).length)}天`
  return `第${allLogs.filter((l) => l.type === 11).length + 1}夜`
}

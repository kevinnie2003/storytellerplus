// 整局记录：和 iPad 版 GameLogEntry.toString 一样的文字
import type { GameLogEntry } from './types'
import { uuid } from './uuid'

export interface LogParams {
  message: string
  messager: number
  source?: string
  type?: number
  characterName?: string
  audioURL?: string
  playerNumbers?: number[]
  playerCharacters?: string[]
  playerTeams?: number[]
}

function toText(p: Required<Omit<LogParams, 'audioURL'>>): string {
  const { message, messager, type, characterName, playerNumbers: n, playerCharacters: c } = p
  switch (type) {
    case 0: return `${messager}号玩家 获得角色 ${c[0]}`
    case 1: return `${messager}号玩家 ${c[0]} 获得标签 ${message}，来源为：${n[0] >= 0 ? `${n[0] + 1} ` : ''}${c[1]}`
    case 2:
      if (messager < 0) return `============\n${characterName} 被唤醒了\n============\n${message}`
      return `============\n${messager}号玩家 ${characterName} 被唤醒了\n============\n${message}`
    case 3: return `${messager}号玩家： ${message}`
    case 4: return `${messager}号玩家 ${characterName} 提名了 ${n[1]} 号玩家 ${c[1]})`
    case 5: return message
    case 6: return `${messager}号玩家 ${characterName} 死亡`
    case 7: return `${messager}号玩家 加入游戏`
    case 8: return '------------游戏开始了------------'
    case 9: return '------------第一晚开始了------------'
    case 10: return '------------白天开始了------------'
    case 11: return '------------晚上开始了------------'
    case 12: return `${messager}号玩家 ${characterName} 复活`
    case 13: return `恶魔得知伪装: ${c[0]}`
    case 14: return `${messager}号玩家 ${c[0]} 失去标签 ${message}，来源为：${c[1]}`
    case 15: return `${messager}号玩家 ${c[0]} 倒置标签 ${message}，来源为：${c[1]}`
    case 16: return `添加全局标签：${message}，来源为：${n[0] >= 0 ? `${n[0] + 1} ` : ''}${c[0]}`
    case 17: return `去除全局标签：${message}，来源为：${n[0] >= 0 ? `${n[0] + 1} ` : ''}${c[0]}`
    case 18: return `全局标签倒置：${message}，来源为：${n[0] >= 0 ? `${n[0] + 1} ` : ''}${c[0]}`
    default: return ''
  }
}

export function makeLog(p: LogParams): GameLogEntry {
  const full = {
    message: p.message,
    messager: p.messager,
    source: p.source ?? '',
    type: p.type ?? 0,
    characterName: p.characterName ?? '',
    playerNumbers: p.playerNumbers ?? [],
    playerCharacters: p.playerCharacters ?? [],
    playerTeams: p.playerTeams ?? [],
  }
  return {
    ...full,
    id: uuid(),
    timestamp: Date.now(),
    audioURL: p.audioURL ?? '',
    logText: toText(full),
  }
}

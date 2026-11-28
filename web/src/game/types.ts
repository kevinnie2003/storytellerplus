// 和 iPad 版（说书人普拉斯/Structs）一一对应的数据结构，字段名保持一致，方便对照移植

export type Team = 'townsfolk' | 'outsider' | 'minion' | 'demon' | 'traveler' | 'fabled' | string

export interface Character {
  id: string
  name: string
  ability: string
  firstNightOrder: number
  otherNightOrder: number
  firstNightReminder: string
  otherNightReminder: string
  setup: boolean
  team: Team
  imageURL: string
}

export interface Reminder {
  from: string
  effect: string
  /** 0 镇民 1 外来者 2 爪牙 3 恶魔 4 旅行者 5 其他（说书人、传奇） */
  team: number
  isGlobal: boolean
  /** -1 还没对应到座位，-2 说书人 */
  playerId: number
  isReversed: boolean
}

export const reminderId = (r: Reminder) => `${r.playerId}-${r.from}-${r.effect}-${r.isGlobal}`

export interface Jinx {
  name: string
  imageURL: string
  /** 1 相克规则，0 游戏状态 */
  type: number
  description: string
}

export interface OrderInfo {
  order: number
  reminder: string
  playerID: number
  imageURL: string
  characterName: string
  team: string
}

export interface GameLogEntry {
  id: string
  timestamp: number
  message: string
  messager: number
  source: string
  /**
   * 0 发角色 1 加标签 2 唤醒 3 发言 4 提名 5 投票 6 死亡 7 加人 8 开始游戏 9 第一夜 10 白天 11 夜晚
   * 12 复活 13 恶魔伪装 14 失去标签 15 倒置标签 16 加全局标签 17 去全局标签 18 倒置全局标签
   */
  type: number
  characterName: string
  logText: string
  audioURL: string
  playerNumbers: number[]
  playerCharacters: string[]
  playerTeams: number[]
}

export interface GameSaveData {
  playName: string
  playAuthor: string
  gameState: number
  characters: Character[]
  playersAssignedCharacters: Character[]
  playersIsAlive: boolean[]
  playersHasDeathVote: boolean[]
  aliveCount: number
  playableCharacters: Character[]
  travelers: Character[]
  fabled: Character[]
  notPresentedGoodCharacters: Character[]
  jinxList: Jinx[]
  allReminders: Reminder[]
  playersStates: Reminder[][]
  currentSelectedPlayerID: number
  selectNewCharacter: boolean
  currentSelectedPlayerIDForReminder: number
  selectNewReminder: boolean
  selectedReminderIndex: number
  allLogs: GameLogEntry[]
  firstNightOrder: boolean
  currentlyAwakePlayerIndex: number
  selectedFabledCharacters: Character[]
  globalStates: Reminder[]
  gameID?: string
  /** 结束游戏时说书人选的胜利方：good / evil，没结束是空 */
  winner?: string
}

export const defaultCharacter: Character = {
  id: ' ', name: '', ability: '', firstNightOrder: 0, otherNightOrder: 0,
  firstNightReminder: '', otherNightReminder: '', setup: false, team: '', imageURL: '',
}

export function makeCharacter(p: Partial<Character> & { id: string; name: string }): Character {
  return { ...defaultCharacter, ability: '', ...p }
}

export function makeReminder(from: string, effect: string, team = 5, isGlobal = false, playerId = -1): Reminder {
  return { from, effect, team, isGlobal, playerId, isReversed: false }
}

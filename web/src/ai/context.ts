// 当前游戏的快照，交给 AI 当上下文。对应 AIPrompts.swift 里的 AIGameContext 和 StoryTellerView.makeAIContext
import type { Character, GameLogEntry, GameSaveData, Jinx, Reminder } from '../game/types'
import { useGame } from '../game/store'

export interface AIGameContext {
  playName: string
  gameState: number
  playableCharacters: Character[]
  players: Character[]
  alive: boolean[]
  deathVote: boolean[]
  playerTags: Reminder[][]
  globalTags: Reminder[]
  bluffs: Character[]
  fabled: Character[]
  jinxes: Jinx[]
  logs: GameLogEntry[]
  allReminders: Reminder[]
  setupNotes: string
  /** 结束游戏时说书人选的胜利方：good / evil，没结束是空 */
  winner?: string
}

/** 从小镇现在的状态拼出上下文 */
export function makeAIContext(): AIGameContext {
  const s = useGame.getState()
  return {
    playName: s.playName,
    gameState: s.gameState,
    playableCharacters: s.playableCharacters,
    players: s.playersAssignedCharacters,
    alive: s.playersIsAlive,
    deathVote: s.playersHasDeathVote,
    playerTags: s.playersStates,
    globalTags: s.globalStates,
    bluffs: s.notPresentedGoodCharacters,
    fabled: s.selectedFabledCharacters,
    jinxes: s.jinxList,
    logs: s.allLogs,
    allReminders: s.allReminders,
    setupNotes: s.aiSetupNotes,
  }
}

/** 从存档拼出上下文（复盘用） */
export function contextFromSave(game: GameSaveData): AIGameContext {
  return {
    playName: game.playName,
    gameState: game.gameState,
    playableCharacters: game.playableCharacters,
    players: game.playersAssignedCharacters,
    alive: game.playersIsAlive,
    deathVote: game.playersHasDeathVote,
    playerTags: game.playersStates,
    globalTags: game.globalStates,
    bluffs: game.notPresentedGoodCharacters,
    fabled: game.selectedFabledCharacters,
    jinxes: game.jinxList,
    logs: game.allLogs,
    allReminders: game.allReminders,
    setupNotes: '',
    winner: game.winner ?? '',
  }
}

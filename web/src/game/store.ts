// 小镇的全部状态，对应 iPad 版 StoryTellerView 里的 @State，名字保持一致。
// 各个界面直接读写这里；需要组合逻辑的操作放在 game/actions.ts。
import { create } from 'zustand'
import type { Character, GameLogEntry, Jinx, Reminder } from './types'
import { defaultCharacter } from './types'

export interface GameState {
  // 剧本
  playName: string
  playAuthor: string
  characters: Character[]
  playableCharacters: Character[]
  travelers: Character[]
  fabled: Character[]
  jinxList: Jinx[]
  allReminders: Reminder[]

  // 座位
  playerCount: number
  aliveCount: number
  playersAssignedCharacters: Character[]
  playersIsAlive: boolean[]
  playersHasDeathVote: boolean[]
  playersStates: Reminder[][]
  globalStates: Reminder[]
  notPresentedGoodCharacters: Character[]
  selectedFabledCharacters: Character[]

  // 进程：0 配版 1 第一夜 2 白天 3 夜晚
  gameState: number
  firstNightOrder: boolean
  currentlyAwakePlayerIndex: number
  votingPhase: number
  nominationPhase: number
  allLogs: GameLogEntry[]
  gameID: string

  // 弹出的面板
  selectNewCharacter: boolean
  currentSelectedPlayerID: number
  selectNewReminder: boolean
  currentSelectedPlayerIDForReminder: number
  selectedReminderIndex: number
  showMenu: boolean
  showSetup: boolean
  showNotepad: boolean
  showConversation: boolean
  showAllCharacterInfos: boolean
  showFabledCharactersSelection: boolean
  showSettings: boolean
  showArchive: boolean
  showAIAdvisor: boolean
  showAIPostDraw: boolean
  showExitConfirmation: boolean
  openAISetupOnAppear: boolean
  aiSetupNotes: string
  predefinedTags: string[]
  alertMessage: string

  set: (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void
}

export const initialGameState: Omit<GameState, 'set'> = {
  playName: '',
  playAuthor: '',
  characters: [],
  playableCharacters: [],
  travelers: [],
  fabled: [],
  jinxList: [],
  allReminders: [],
  playerCount: 0,
  aliveCount: 0,
  playersAssignedCharacters: [],
  playersIsAlive: [],
  playersHasDeathVote: [],
  playersStates: [],
  globalStates: [],
  notPresentedGoodCharacters: [defaultCharacter, defaultCharacter, defaultCharacter],
  selectedFabledCharacters: [],
  gameState: 0,
  firstNightOrder: true,
  currentlyAwakePlayerIndex: -666,
  votingPhase: 2,
  nominationPhase: 0,
  allLogs: [],
  gameID: '',
  selectNewCharacter: false,
  currentSelectedPlayerID: 0,
  selectNewReminder: false,
  currentSelectedPlayerIDForReminder: 0,
  selectedReminderIndex: 0,
  showMenu: false,
  showSetup: false,
  showNotepad: false,
  showConversation: false,
  showAllCharacterInfos: false,
  showFabledCharactersSelection: false,
  showSettings: false,
  showArchive: false,
  showAIAdvisor: false,
  showAIPostDraw: false,
  showExitConfirmation: false,
  openAISetupOnAppear: false,
  aiSetupNotes: '',
  predefinedTags: [],
  alertMessage: '',
}

export const useGame = create<GameState>((set) => ({
  ...initialGameState,
  set: (partial) => set(partial as never),
}))

/** 在组件外读写状态 */
export const game = () => useGame.getState()
export const setGame = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => useGame.getState().set(partial)

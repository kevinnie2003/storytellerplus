// 存档：对应 iPad 版 StoryTellerView.saveGame / GameArchive.swift / ReviewStore
// “继续上一局”的最近存档放 localStorage（键名同 iPad 的 SavedGameState），存档列表和复盘放 IndexedDB
import { createStore, del, entries, get, set } from 'idb-keyval'
import type { GameSaveData } from './types'
import { useGame, type GameState } from './store'
import { uuid } from './uuid'

const archiveDB = createStore('storytellerplus', 'archive')
const recapDB = createStore('storytellerplus-recap', 'recap')

export function makeSaveData(s: GameState = useGame.getState()): GameSaveData {
  return {
    playName: s.playName,
    playAuthor: s.playAuthor,
    gameState: s.gameState,
    characters: s.characters,
    playersAssignedCharacters: s.playersAssignedCharacters,
    playersIsAlive: s.playersIsAlive,
    playersHasDeathVote: s.playersHasDeathVote,
    aliveCount: s.aliveCount,
    playableCharacters: s.playableCharacters,
    travelers: s.travelers,
    fabled: s.fabled,
    notPresentedGoodCharacters: s.notPresentedGoodCharacters,
    jinxList: s.jinxList,
    allReminders: s.allReminders,
    playersStates: s.playersStates,
    currentSelectedPlayerID: s.currentSelectedPlayerID,
    selectNewCharacter: s.selectNewCharacter,
    currentSelectedPlayerIDForReminder: s.currentSelectedPlayerIDForReminder,
    selectNewReminder: s.selectNewReminder,
    selectedReminderIndex: s.selectedReminderIndex,
    allLogs: s.allLogs,
    firstNightOrder: s.firstNightOrder,
    currentlyAwakePlayerIndex: s.currentlyAwakePlayerIndex,
    selectedFabledCharacters: s.selectedFabledCharacters,
    globalStates: s.globalStates,
    gameID: s.gameID,
    winner: s.gameWinner,
  }
}

/** 把存档放回小镇 */
export function applySaveData(d: GameSaveData) {
  useGame.getState().set({
    playName: d.playName,
    playAuthor: d.playAuthor,
    gameState: d.gameState,
    characters: d.characters,
    playersAssignedCharacters: d.playersAssignedCharacters,
    playersIsAlive: d.playersIsAlive,
    playersHasDeathVote: d.playersHasDeathVote,
    playerCount: d.playersAssignedCharacters.length,
    aliveCount: d.aliveCount,
    playableCharacters: d.playableCharacters,
    travelers: d.travelers,
    fabled: d.fabled,
    notPresentedGoodCharacters: d.notPresentedGoodCharacters,
    jinxList: d.jinxList,
    allReminders: d.allReminders,
    playersStates: d.playersStates,
    currentSelectedPlayerID: d.currentSelectedPlayerID,
    selectNewCharacter: false,
    currentSelectedPlayerIDForReminder: d.currentSelectedPlayerIDForReminder,
    selectNewReminder: false,
    selectedReminderIndex: d.selectedReminderIndex,
    allLogs: d.allLogs,
    firstNightOrder: d.firstNightOrder,
    currentlyAwakePlayerIndex: d.currentlyAwakePlayerIndex,
    selectedFabledCharacters: d.selectedFabledCharacters,
    globalStates: d.globalStates,
    gameID: d.gameID || uuid(),
    gameWinner: d.winner ?? '',
  })
}

/** 开始游戏之后，或者每个座位都分到了角色，就存进存档列表 */
export function shouldArchive(d: GameSaveData): boolean {
  if (d.gameState !== 0) return true
  const seats = d.playersAssignedCharacters
  return seats.length > 0 && seats.every((c) => c.name !== '')
}

export function loadLastGame(): GameSaveData | null {
  try {
    const raw = localStorage.getItem('SavedGameState')
    return raw ? (JSON.parse(raw) as GameSaveData) : null
  } catch {
    return null
  }
}

export function saveLastGame(d: GameSaveData) {
  try { localStorage.setItem('SavedGameState', JSON.stringify(d)) } catch { /* 空间满了就算了 */ }
}

export interface ArchiveRecord { data: GameSaveData; savedAt: number }

export interface ArchiveEntry {
  id: string
  playName: string
  playerCount: number
  aliveCount: number
  alive: boolean[]
  dayCount: number
  gameState: number
  savedAt: number
  /** 点过“结束游戏”的话是胜利方：good / evil */
  winner: string
}

export async function archiveSave(d: GameSaveData) {
  if (!d.gameID || !shouldArchive(d)) return
  await set(d.gameID, { data: d, savedAt: Date.now() } satisfies ArchiveRecord, archiveDB)
}

export async function archiveLoad(id: string): Promise<GameSaveData | null> {
  const r = await get<ArchiveRecord>(id, archiveDB)
  return r?.data ?? null
}

export async function archiveDelete(id: string) {
  await del(id, archiveDB)
  await del(id, recapDB)
  await del(`${id}.png`, recapDB)
  await del(`${id}.v2.png`, recapDB)
}

export async function archiveList(): Promise<ArchiveEntry[]> {
  const all = await entries<string, ArchiveRecord>(archiveDB)
  return all
    .map(([id, r]) => ({
      id,
      playName: r.data.playName,
      playerCount: r.data.playersAssignedCharacters.length,
      aliveCount: r.data.aliveCount,
      alive: r.data.playersIsAlive,
      dayCount: r.data.allLogs.filter((l) => l.type === 10).length,
      gameState: r.data.gameState,
      savedAt: r.savedAt,
      winner: r.data.winner ?? '',
    }))
    .sort((a, b) => b.savedAt - a.savedAt)
}

/** 现在这一局：存“继续上一局”，够条件的再进存档列表。演示小镇不存 */
export function saveGame() {
  const s = useGame.getState()
  if (s.gameID === 'demo') return
  const d = makeSaveData(s)
  saveLastGame(d)
  void archiveSave(d)
}

// 复盘：AI 生成的复盘内容和画好的复盘图
export async function recapLoad<T>(id: string): Promise<T | null> { return (await get<T>(id, recapDB)) ?? null }
export async function recapSave(id: string, recap: unknown) { await set(id, recap, recapDB) }
// 复盘图的键名带版本号：之前在 Safari 上存下的旧图可能没画上图标（v1 = `${id}.png`），换个键名让它们重画一次
const posterKey = (id: string) => `${id}.v2.png`
export async function recapPosterLoad(id: string): Promise<Blob | null> { return (await get<Blob>(posterKey(id), recapDB)) ?? null }
export async function recapPosterSave(id: string, png: Blob) { await set(posterKey(id), png, recapDB); await del(`${id}.png`, recapDB) }
export async function recapPosterDelete(id: string) { await del(posterKey(id), recapDB); await del(`${id}.png`, recapDB) }

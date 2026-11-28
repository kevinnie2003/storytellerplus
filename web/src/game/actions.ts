// 小镇里需要组合几个状态的操作，对应 iPad 版 Town/TownActions.swift、MenuView、SubMenuView、PlayersView 里的函数
import type { Character, GameLogEntry, Reminder } from './types'
import { defaultCharacter } from './types'
import { game, setGame } from './store'
import { makeLog } from './log'
import { registerUndo } from './undo'
import { teamCounts } from './builtins'
import { team2Int } from './loadScript'
import { settings } from '../settings/store'
import { showAlert } from '../ui/Alert'

const shuffled = <T,>(a: T[]): T[] => {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

const removeLogById = (id: string) => setGame((s) => ({ allLogs: s.allLogs.filter((l) => l.id !== id) }))

/** 切换某名玩家的死亡/复活，写记录，并登记撤销 */
export function toggleAlive(index: number) {
  const s = game()
  if (index >= s.playersAssignedCharacters.length || index >= s.playersIsAlive.length) return
  const character = s.playersAssignedCharacters[index]
  const hadDeathVote = index < s.playersHasDeathVote.length ? s.playersHasDeathVote[index] : true
  const nowAlive = !s.playersIsAlive[index]
  const entry = makeLog({
    message: '', messager: index + 1, source: '说书人', type: nowAlive ? 12 : 6, characterName: character.name,
    playerNumbers: [index + 1], playerCharacters: [character.name], playerTeams: [team2Int(character.team)],
  })
  setGame((st) => {
    const alive = [...st.playersIsAlive]
    alive[index] = nowAlive
    const deathVote = [...st.playersHasDeathVote]
    if (nowAlive && index < deathVote.length) deathVote[index] = true
    return {
      playersIsAlive: alive,
      playersHasDeathVote: deathVote,
      aliveCount: st.aliveCount + (nowAlive ? 1 : -1),
      allLogs: [...st.allLogs, entry],
    }
  })
  registerUndo(nowAlive ? `${index + 1} 号已复活` : `${index + 1} 号已死亡`, () => {
    setGame((st) => {
      if (index >= st.playersIsAlive.length) return {}
      const alive = [...st.playersIsAlive]
      alive[index] = !nowAlive
      const deathVote = [...st.playersHasDeathVote]
      if (index < deathVote.length) deathVote[index] = hadDeathVote
      return {
        playersIsAlive: alive,
        playersHasDeathVote: deathVote,
        aliveCount: st.aliveCount + (nowAlive ? -1 : 1),
        allLogs: st.allLogs.filter((l) => l.id !== entry.id),
      }
    })
  })
}

/** 标签在哪：'global' 全局标签，数字是座位 */
export type ReminderTarget = 'global' | number

function getList(target: ReminderTarget): Reminder[] {
  const s = game()
  return target === 'global' ? s.globalStates : (s.playersStates[target] ?? [])
}

function setList(target: ReminderTarget, list: Reminder[]) {
  if (target === 'global') setGame({ globalStates: list })
  else setGame((s) => {
    const states = [...s.playersStates]
    states[target] = list
    return { playersStates: states }
  })
}

/** 点号码切换死亡/复活：配版阶段不行；按设置先确认 */
export function requestToggleAlive(index: number) {
  const s = game()
  if (s.gameState === 0 || index >= s.playersIsAlive.length) return
  if (settings().confirmDeath) {
    showAlert({
      title: s.playersIsAlive[index] ? `让 ${index + 1} 号死亡吗？` : `让 ${index + 1} 号复活吗？`,
      buttons: [
        { label: '取消', role: 'cancel' },
        { label: '确定', role: 'destructive', action: () => toggleAlive(index) },
      ],
    })
  } else {
    toggleAlive(index)
  }
}

/** 删掉一个标签，写记录，并登记撤销 */
export function removeReminder(target: ReminderTarget, position: number, logEntry: GameLogEntry, label: string) {
  const list = getList(target)
  if (position >= list.length) return
  const reminder = list[position]
  setList(target, list.filter((_, i) => i !== position))
  setGame((s) => ({ allLogs: [...s.allLogs, logEntry] }))
  registerUndo(`已删除${label}“${reminder.effect}”`, () => {
    const now = [...getList(target)]
    now.splice(Math.min(position, now.length), 0, reminder)
    setList(target, now)
    removeLogById(logEntry.id)
  })
}

/** 长按标签：倒置，写记录，并登记撤销 */
export function reverseReminder(target: ReminderTarget, position: number, logEntry: GameLogEntry, undoMessage: string) {
  const list = getList(target)
  if (position >= list.length) return
  const flip = () => {
    const now = getList(target)
    if (position >= now.length) return false
    setList(target, now.map((r, i) => (i === position ? { ...r, isReversed: !r.isReversed } : r)))
    return true
  }
  flip()
  setGame((s) => ({ allLogs: [...s.allLogs, logEntry] }))
  registerUndo(undoMessage, () => {
    if (!flip()) return
    removeLogById(logEntry.id)
  })
}

/** 删除座位上的一个标签（卡片上双击） */
export function removePlayerReminder(index: number, reminderIndex: number) {
  const s = game()
  const reminder = s.playersStates[index]?.[reminderIndex]
  const character = s.playersAssignedCharacters[index]
  if (!reminder || !character) return
  const entry = makeLog({
    message: `${reminder.effect}`, messager: index + 1, source: reminder.from, type: 14, characterName: character.name,
    playerNumbers: [index + 1], playerCharacters: [character.name, reminder.from], playerTeams: [team2Int(character.team), reminder.team],
  })
  removeReminder(index, reminderIndex, entry, `${index + 1} 号的标签`)
}

/** 倒置座位上的一个标签（卡片上长按 1 秒） */
export function reversePlayerReminder(index: number, reminderIndex: number) {
  const s = game()
  const reminder = s.playersStates[index]?.[reminderIndex]
  const character = s.playersAssignedCharacters[index]
  if (!reminder || !character) return
  const entry = makeLog({
    message: `${reminder.effect}`, messager: index + 1, source: reminder.from, type: 15, characterName: character.name,
    playerNumbers: [index + 1], playerCharacters: [character.name, reminder.from], playerTeams: [team2Int(character.team), reminder.team],
  })
  reverseReminder(index, reminderIndex, entry, `已倒置“${reminder.effect}”`)
}

export function removeGlobalReminder(reminderIndex: number) {
  const reminder = game().globalStates[reminderIndex]
  if (!reminder) return
  const entry = makeLog({
    message: `${reminder.effect}`, messager: -10, source: reminder.from, type: 17, characterName: '全局',
    playerNumbers: [reminder.playerId], playerCharacters: [reminder.from], playerTeams: [reminder.team],
  })
  removeReminder('global', reminderIndex, entry, '全局标签')
}

export function reverseGlobalReminder(reminderIndex: number) {
  const reminder = game().globalStates[reminderIndex]
  if (!reminder) return
  const entry = makeLog({
    message: `${reminder.effect}`, messager: -10, source: reminder.from, type: 18, characterName: '全局',
    playerNumbers: [reminder.playerId], playerCharacters: [reminder.from], playerTeams: [reminder.team],
  })
  reverseReminder('global', reminderIndex, entry, `已倒置全局标签“${reminder.effect}”`)
}

/** 打开标签选择：座位号，-2 是全局标签 */
export function openTagPicker(playerIndex: number) {
  setGame({ currentSelectedPlayerIDForReminder: playerIndex, selectNewReminder: true, selectedReminderIndex: -1 })
}

/** 打开角色选择：座位号；恶魔伪装是 21、22、23 */
export function openCharacterSelection(playerIndex: number) {
  setGame({ currentSelectedPlayerID: playerIndex, selectNewCharacter: true })
}

// MARK: 左边菜单：入夜、天亮

export function goNight() {
  const s = game()
  if (s.gameState !== 2) return
  setGame({
    gameState: 3,
    firstNightOrder: false,
    allLogs: [...s.allLogs, makeLog({ message: '夜晚', messager: 0, source: '说书人', type: 11, characterName: '' })],
  })
}

export function goDay() {
  const s = game()
  if (s.gameState !== 1 && s.gameState !== 3) return
  setGame({
    gameState: 2,
    firstNightOrder: false,
    allLogs: [...s.allLogs, makeLog({ message: '白天', messager: 0, source: '说书人', type: 10, characterName: '' })],
    votingPhase: 0,
    nominationPhase: 0,
  })
}

// MARK: 齿轮面板：加减人、随机分配、开始游戏

/** 能不能减少玩家：配版阶段随时可以；游戏开始后只能去掉最后一个、还没分配角色的玩家（比如中途误加的人） */
export function canRemoveLastPlayer(s = game()): boolean {
  const last = s.playersAssignedCharacters[s.playersAssignedCharacters.length - 1]
  if (s.playerCount <= 0 || !last) return false
  return s.gameState === 0 || last.name === ''
}

export function removeLastPlayer() {
  const s = game()
  if (!canRemoveLastPlayer(s)) return
  const lastIndex = s.playersAssignedCharacters.length - 1
  const wasAlive = lastIndex < s.playersIsAlive.length ? s.playersIsAlive[lastIndex] : true
  const removedCharacter = s.playersAssignedCharacters[lastIndex]
  const removedStates = lastIndex < s.playersStates.length ? s.playersStates[lastIndex] : []
  const removedVote = lastIndex < s.playersHasDeathVote.length ? s.playersHasDeathVote[lastIndex] : true
  let removedLog: [number, GameLogEntry] | null = null
  let logs = s.allLogs
  if (s.gameState !== 0) {
    let i = -1
    for (let k = logs.length - 1; k >= 0; k--) if (logs[k].type === 7 && logs[k].messager === lastIndex + 1) { i = k; break }
    if (i >= 0) {
      // 撤掉“几号玩家加入游戏”这条记录
      removedLog = [i, logs[i]]
      logs = logs.filter((_, k) => k !== i)
    }
  }
  setGame({
    aliveCount: wasAlive ? s.aliveCount - 1 : s.aliveCount,
    playersAssignedCharacters: s.playersAssignedCharacters.slice(0, -1),
    playersStates: s.playersStates.slice(0, -1),
    playersIsAlive: s.playersIsAlive.slice(0, -1),
    playersHasDeathVote: s.playersHasDeathVote.slice(0, -1),
    allLogs: logs,
    playerCount: Math.max(s.playerCount - 1, 0),
  })
  registerUndo(`已删除 ${lastIndex + 1} 号`, () => {
    setGame((st) => {
      let allLogs = st.allLogs
      if (removedLog) {
        allLogs = [...allLogs]
        allLogs.splice(Math.min(removedLog[0], allLogs.length), 0, removedLog[1])
      }
      return {
        playersAssignedCharacters: [...st.playersAssignedCharacters, removedCharacter],
        playersStates: [...st.playersStates, removedStates],
        playersIsAlive: [...st.playersIsAlive, wasAlive],
        playersHasDeathVote: [...st.playersHasDeathVote, removedVote],
        aliveCount: wasAlive ? st.aliveCount + 1 : st.aliveCount,
        allLogs,
        playerCount: st.playerCount + 1,
      }
    })
  })
}

export function addPlayer() {
  const s = game()
  if (s.playerCount >= 20) return
  let joinLog: GameLogEntry | null = null
  if (s.gameState !== 0) {
    joinLog = makeLog({ message: '', messager: s.playerCount + 1, source: '说书人', type: 7, playerNumbers: [s.playerCount + 1] })
  }
  setGame({
    aliveCount: s.aliveCount + 1,
    playersAssignedCharacters: [...s.playersAssignedCharacters, defaultCharacter],
    playersStates: [...s.playersStates, []],
    playersIsAlive: [...s.playersIsAlive, true],
    playersHasDeathVote: [...s.playersHasDeathVote, true],
    allLogs: joinLog ? [...s.allLogs, joinLog] : s.allLogs,
    playerCount: s.playerCount + 1,
  })
  const added = s.playerCount + 1
  registerUndo(`已加入 ${added} 号`, () => {
    const st = game()
    // 只在最后一位还是刚加的空位时撤销
    const last = st.playersAssignedCharacters[st.playersAssignedCharacters.length - 1]
    if (st.playersAssignedCharacters.length !== added || last?.name !== '') return
    const lastAlive = st.playersIsAlive[st.playersIsAlive.length - 1]
    setGame({
      playersAssignedCharacters: st.playersAssignedCharacters.slice(0, -1),
      playersStates: st.playersStates.slice(0, -1),
      playersIsAlive: st.playersIsAlive.slice(0, -1),
      aliveCount: st.playersIsAlive.length > 0 && lastAlive ? st.aliveCount - 1 : st.aliveCount,
      playersHasDeathVote: st.playersHasDeathVote.slice(0, -1),
      allLogs: joinLog ? st.allLogs.filter((l) => l.id !== joinLog!.id) : st.allLogs,
      playerCount: st.playerCount - 1,
    })
  })
}

const teamNames = ['townsfolk', 'outsider', 'minion', 'demon', 'traveler']

function selectCharacters(team: number): Character[] {
  const s = game()
  const teamCount = teamCounts[s.playerCount] ?? [0, 0, 0, 0, 0]
  const n = teamCount[team] ?? 0
  const filtered = s.playableCharacters.filter((c) => c.team === teamNames[team])
  if (filtered.length === 0) return Array.from({ length: n }, () => defaultCharacter)
  if (filtered.length >= n) return shuffled(filtered).slice(0, n)
  return Array.from({ length: n }, () => filtered[Math.floor(Math.random() * filtered.length)])
}

export function randomAssign() {
  const s = game()
  if (s.playerCount < 5) return
  const selected = [0, 1, 2, 3, 4].flatMap((t) => selectCharacters(t))
  const assigned = shuffled(selected)
  const good = s.playableCharacters.filter((c) => c.team === 'townsfolk' || c.team === 'outsider')
  const assignedNames = new Set(assigned.map((c) => c.name))
  const unassignedGood = good.filter((c) => !assignedNames.has(c.name))
  setGame({ playersAssignedCharacters: assigned, notPresentedGoodCharacters: shuffled(unassignedGood).slice(0, 3) })
}

export function startGame() {
  const s = game()
  if (s.playersAssignedCharacters.length < 5) return
  const logs = [...s.allLogs]
  s.playersAssignedCharacters.forEach((character, index) => {
    logs.push(makeLog({
      message: `获得角色：${character.name}`, messager: index + 1, source: '说书人', type: 0,
      playerCharacters: [character.name], playerTeams: [team2Int(character.team)],
    }))
    for (const reminder of s.playersStates[index] ?? []) {
      logs.push(makeLog({
        message: `${reminder.effect}`, messager: index + 1, source: reminder.from, type: 1, characterName: character.name,
        playerNumbers: [reminder.playerId], playerCharacters: [character.name, reminder.from], playerTeams: [team2Int(character.team), reminder.team],
      }))
    }
  })
  for (const character of s.notPresentedGoodCharacters) {
    if (character.name !== '') {
      logs.push(makeLog({ message: '', messager: 0, source: '说书人', type: 13, playerCharacters: [character.name], playerTeams: [team2Int(character.team)] }))
    }
  }
  logs.push(makeLog({ message: '游戏开始', messager: 0, source: '说书人', type: 8, characterName: '' }))
  logs.push(makeLog({ message: '第一夜', messager: 0, source: '说书人', type: 9, characterName: '' }))
  setGame({ allLogs: logs, gameState: s.gameState === 0 ? 1 : s.gameState, showMenu: false })
}

// MARK: AI 补完配版

export interface AIPostDrawTagLike { playerIndex: number; from: string; effect: string }

/** 把 AI 建议的开局标记和恶魔伪装写进魔典，对应 StoryTellerView.applyAIPostDraw */
export function applyAIPostDraw(tags: AIPostDrawTagLike[], bluffs: Character[]) {
  const s = game()
  const states = s.playersStates.map((l) => [...l])
  for (const tag of tags) {
    if (tag.playerIndex < 0 || tag.playerIndex >= states.length) continue
    const template = s.allReminders.find((r) => r.from === tag.from && r.effect === tag.effect)
    const sourceTeam = s.characters.find((c) => c.name === tag.from)?.team ?? ''
    const sourcePlayer = s.playersAssignedCharacters.findIndex((c) => c.name === tag.from)
    const reminder: Reminder = {
      from: tag.from, effect: tag.effect, team: template?.team ?? team2Int(sourceTeam),
      isGlobal: template?.isGlobal ?? false, playerId: sourcePlayer, isReversed: false,
    }
    if (!states[tag.playerIndex].some((r) => r.from === reminder.from && r.effect === reminder.effect)) {
      states[tag.playerIndex].push(reminder)
    }
  }
  setGame({ playersStates: states, ...(bluffs.length === 3 ? { notPresentedGoodCharacters: bluffs } : {}) })
}

/** 按名字找角色图标，对应 Helpers.getImageURL */
export function getImageURL(name: string, characters: Character[]): string {
  return characters.find((c) => c.name === name)?.imageURL ?? ''
}

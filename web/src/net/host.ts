// 说书人这边的联机房间：开房间、自动重连、跟着小镇同步座位数和昼夜、发信息、把玩家的回复记进整局记录
import { create } from 'zustand'
import { game, setGame, useGame } from '../game/store'
import { makeLog } from '../game/log'
import { phaseLabel } from '../game/phase'
import { team2Int } from '../game/loadScript'
import type { Character, GameLogEntry } from '../game/types'
import { uuid } from '../game/uuid'
import { createRoom, RoomSocket, type SocketStatus } from './relay'
import type { RoleInfo, RoomInfo, RoomMessage, ServerMessage, Whisper } from './protocol'
import { showAlert } from '../ui/Alert'

interface HostState {
  code: string
  status: SocketStatus | 'off'
  room: RoomInfo | null
  messages: RoomMessage[]
  /** 玩家主动发来的 */
  whispers: Whisper[]
  error: string
  /** 全员同步：发给一个人时，其他已入座的人也收到一条“点确认” */
  syncAll: boolean
  /** 说书人的联机面板开着没有 */
  showPanel: boolean
  /** 记事本里“发给”默认选的座位（从夜晚顺序点“发信息”打开时） */
  notepadTarget: number
}

const SAVE_KEY = 'RoomHost'
const SYNC_KEY = 'RoomSyncAll'

const readSync = () => { try { return localStorage.getItem(SYNC_KEY) !== '0' } catch { return true } }

export const useHost = create<HostState>(() => ({
  code: '', status: 'off', room: null, messages: [], whispers: [], error: '', syncAll: readSync(), showPanel: false, notepadTarget: -1,
}))
const set = (patch: Partial<HostState>) => useHost.setState(patch)

interface Saved { code: string; hostToken: string; gameID: string }
function readSaved(): Saved | null {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as Saved | null } catch { return null }
}
function writeSaved(v: Saved | null) {
  try { if (v) localStorage.setItem(SAVE_KEY, JSON.stringify(v)); else localStorage.removeItem(SAVE_KEY) } catch { /* 存不了就算了 */ }
}

let socket: RoomSocket | null = null
let unsubGame: (() => void) | null = null
/** 第一次收到消息列表时不记日志（那些是以前的） */
let primed = false

function seatName(seat: number): string {
  return game().playersAssignedCharacters[seat]?.name ?? ''
}

/** 玩家已读、选了人：记进整局记录 */
function logResponses(prev: RoomMessage[], next: RoomMessage[]) {
  const before = new Map(prev.map((m) => [m.id, m]))
  const logs: GameLogEntry[] = []
  for (const m of next) {
    const old = before.get(m.id)
    if (m.kind === 'ask' && m.reply !== undefined && old?.reply === undefined) {
      const players = game().playersAssignedCharacters
      const name = seatName(m.seat)
      logs.push(makeLog({
        message: `（手机）发动能力：${m.reply || '（没写）'}`,
        messager: m.seat + 1, type: 3, characterName: name, playerCharacters: [name],
        playerTeams: [team2Int(players[m.seat]?.team ?? '')],
      }))
      const reply = m.reply
      showAlert({
        title: `${m.seat + 1}号${name ? ` ${name}` : ''} 回复了`,
        message: reply || '（他没写内容）',
        buttons: [{ label: '知道了', role: 'cancel' }, { label: '回复', action: () => replyTo(m.seat) }],
      })
    }
    if (m.kind === 'choose' && m.picks && !old?.picks) {
      const players = game().playersAssignedCharacters
      const name = seatName(m.seat)
      logs.push(makeLog({
        message: `（手机）选了 ${m.picks.map((p) => `${p + 1}号`).join('、') || '没有人'}`,
        messager: m.seat + 1, type: 3, characterName: name, playerCharacters: [name],
        playerTeams: [team2Int(players[m.seat]?.team ?? '')],
      }))
    }
  }
  if (logs.length) setGame((s) => ({ allLogs: [...s.allLogs, ...logs] }))
}

export const whisperLabel = { ability: '申请发动能力', talk: '申请私聊', text: '私信' } as const

/** 打开记事本，发到某个座位 */
export function replyTo(seat: number) {
  useHost.setState({ notepadTarget: seat, showPanel: false })
  setGame({ showNotepad: true })
}

export function markWhispersRead(ids: string[]) {
  if (ids.length) socket?.send({ type: 'whisperRead', ids })
}

/** 已经弹过、记过的私信（存在本机，刷新也不重复） */
const ANNOUNCED_KEY = 'RoomHostAnnounced'
function announced(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(ANNOUNCED_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

/** 玩家发来新私信：弹出来，记进整局记录 */
function announceWhispers(next: Whisper[]) {
  const done = announced()
  const fresh = next.filter((w) => !done.has(w.id))
  if (!fresh.length) return
  try { localStorage.setItem(ANNOUNCED_KEY, JSON.stringify([...done, ...fresh.map((w) => w.id)].slice(-500))) } catch { /* 存不了就算了 */ }
  const players = game().playersAssignedCharacters
  setGame((s) => ({
    allLogs: [...s.allLogs, ...fresh.map((w) => {
      const name = players[w.seat]?.name ?? ''
      return makeLog({
        message: `（手机）${whisperLabel[w.kind]}${w.text ? `：${w.text}` : ''}`,
        messager: w.seat + 1, type: 3, characterName: name, playerCharacters: [name],
        playerTeams: [team2Int(players[w.seat]?.team ?? '')],
      })
    })],
  }))
  for (const w of fresh) {
    const name = players[w.seat]?.name ?? ''
    showAlert({
      title: `${w.seat + 1}号${name ? ` ${name}` : ''}：${whisperLabel[w.kind]}`,
      message: w.text || (w.kind === 'talk' ? '他想单独和你说话' : w.kind === 'ability' ? '他想发动能力' : ''),
      buttons: [
        { label: '稍后', role: 'cancel', action: () => markWhispersRead([w.id]) },
        { label: '回复', action: () => { markWhispersRead([w.id]); replyTo(w.seat) } },
      ],
    })
  }
}

function onMessage(msg: ServerMessage) {
  switch (msg.type) {
    case 'room':
      set({ room: msg.room, error: '' })
      return
    case 'host': {
      const whispers = msg.whispers ?? []
      if (primed) logResponses(useHost.getState().messages, msg.messages)
      // 私信：说书人掉线时发来的，重新连上也要弹出来、记进记录（记过的不重复记）
      announceWhispers(whispers)
      primed = true
      set({ messages: msg.messages, whispers })
      return
    }
    case 'error':
      if (msg.code === 'closed' || msg.code === 'no-room' || msg.code === 'bad-token') {
        stopHost()
        writeSaved(null)
        set({ code: '', room: null, messages: [], whispers: [], error: msg.code === 'closed' ? '' : '房间已经不在了（可能过期了），可以重新开一个' })
      } else {
        set({ error: msg.message })
      }
  }
}

/** 跟着小镇：座位数、第几天第几夜 */
function watchGame() {
  unsubGame?.()
  const push = () => {
    const s = game()
    socket?.send({ type: 'seats', count: s.playersAssignedCharacters.length })
    socket?.send({ type: 'phase', phase: phaseLabel(s.gameState, s.allLogs), night: s.gameState === 1 || s.gameState === 3 })
    // 谁死了、谁还有死人票是公开的，玩家的座位列表里要显示
    socket?.send({ type: 'status', alive: s.playersIsAlive, deadVote: s.playersHasDeathVote })
  }
  let last = ''
  let lastPhase = ''
  unsubGame = useGame.subscribe((s) => {
    const phase = phaseLabel(s.gameState, s.allLogs)
    const key = `${s.playersAssignedCharacters.length}|${phase}|${s.playersIsAlive.join()}|${s.playersHasDeathVote.join()}`
    if (key !== last) { last = key; push() }
    // 换了白天黑夜，投票进度那一行清掉
    if (phase !== lastPhase) { if (lastPhase) socket?.send({ type: 'banner', text: '' }); lastPhase = phase }
  })
  return push
}

function connect(code: string, hostToken: string) {
  socket?.stop()
  primed = false
  set({ code, error: '' })
  const push = watchGame()
  socket = new RoomSocket(
    code,
    () => ({ type: 'hello', hostToken }),
    onMessage,
    (status) => {
      set({ status })
      if (status === 'online') window.setTimeout(push, 50)
    },
  )
}

/** 开一个新房间 */
export async function openRoom() {
  const s = game()
  set({ error: '', status: 'connecting' })
  try {
    const { code, hostToken } = await createRoom(s.playersAssignedCharacters.length)
    writeSaved({ code, hostToken, gameID: s.gameID })
    connect(code, hostToken)
  } catch (e) {
    set({ status: 'off', error: (e as Error).message })
  }
}

/** 进小镇时：这一局开过房间就连回去 */
export function resumeHost() {
  const saved = readSaved()
  const gameID = game().gameID
  if (saved && saved.gameID === gameID && gameID !== 'demo') connect(saved.code, saved.hostToken)
}

/** 离开小镇：断开，但房间留着（一天内回来还能接着用） */
export function stopHost() {
  socket?.stop()
  socket = null
  unsubGame?.()
  unsubGame = null
  set({ status: 'off', room: null, messages: [], whispers: [], code: '' })
}

/** 关掉房间：所有玩家都会被请出去 */
export function closeRoom() {
  socket?.send({ type: 'close' })
  writeSaved(null)
  window.setTimeout(stopHost, 200)
}

export function kickSeat(seat: number) {
  socket?.send({ type: 'kick', seat })
}

export function setSyncAll(v: boolean) {
  try { localStorage.setItem(SYNC_KEY, v ? '1' : '0') } catch { /* 存不了就算了 */ }
  set({ syncAll: v })
}

export const hostOnline = () => useHost.getState().status === 'online'

/** 已经入座的座位 */
function takenSeats(): number[] {
  return (useHost.getState().room?.seats ?? []).map((s, i) => (s.taken ? i : -1)).filter((i) => i >= 0)
}

type Outgoing = Omit<RoomMessage, 'sentAt' | 'readAt' | 'picks' | 'phase'>

/** 发给一个或几个人（算一步）；开着全员同步时，其他入座的人也收到一条“点确认” */
function sendStep(targets: Outgoing | Outgoing[]): boolean {
  const step = uuid()
  const list: Outgoing[] = (Array.isArray(targets) ? targets : [targets]).map((t) => ({ ...t, step }))
  if (useHost.getState().syncAll) {
    const busy = new Set(list.map((t) => t.seat))
    for (const seat of takenSeats()) {
      if (!busy.has(seat)) list.push({ id: uuid(), seat, kind: 'idle', text: '', step })
    }
  }
  return !!socket?.send({ type: 'send', messages: list })
}

/** 一步里给几个人各发一句（比如首夜给每个爪牙发“恶魔是几号”） */
export function sendTexts(items: { seat: number; text: string }[]): boolean {
  if (!items.length) return false
  const ok = sendStep(items.map(({ seat, text }) => ({ id: uuid(), seat, kind: 'text' as const, text })))
  if (ok) items.forEach(({ seat, text }) => logSent(seat, text))
  return ok
}

function logSent(seat: number, text: string) {
  setGame((s) => ({
    allLogs: [...s.allLogs, makeLog({
      message: `（发到 ${seat + 1}号 手机）${text}`, messager: 21, type: 3, characterName: '说书人',
      playerCharacters: ['说书人'], playerTeams: [5],
    })],
  }))
}

export function sendText(seat: number, text: string): boolean {
  const ok = sendStep({ id: uuid(), seat, kind: 'text', text })
  if (ok) logSent(seat, text)
  return ok
}

export function sendChoose(seat: number, count: number, prompt: string): boolean {
  const ok = sendStep({ id: uuid(), seat, kind: 'choose', text: prompt, count })
  if (ok) logSent(seat, `请选 ${count} 名玩家`)
  return ok
}

/** 要他发动能力：玩家在手机上打字回复 */
export function sendAsk(seat: number, prompt: string): boolean {
  const ok = sendStep({ id: uuid(), seat, kind: 'ask', text: prompt })
  if (ok) logSent(seat, `请发动能力：${prompt}`)
  return ok
}

export const roleInfo = (c: Character): RoleInfo => ({ name: c.name, ability: c.ability, imageURL: c.imageURL, team: c.team })

/** 把角色发到玩家手机上：每个座位一条，不用全员同步 */
export function sendRoles(roles: { seat: number; role: RoleInfo }[]): boolean {
  const step = uuid()
  return !!socket?.send({ type: 'send', messages: roles.map(({ seat, role }) => ({ id: uuid(), seat, kind: 'role', text: '', role, step })) })
}

// ——— 白天投票（online/phoneVote.ts 用） ———

/** 问一个人投不投，返回这条的 id；没连上返回空 */
export function sendVote(seat: number, text: string, note: string): string {
  const id = uuid()
  return socket?.send({ type: 'send', messages: [{ id, seat, kind: 'vote', text, note }] }) ? id : ''
}

/** 收回还没回复的（跳过这一位、投票提前结束） */
export function cancelMessages(ids: string[]) {
  if (ids.length) socket?.send({ type: 'cancel', ids })
}

/** 所有玩家手机上都显示的一行进度 */
export function setBanner(text: string) {
  socket?.send({ type: 'banner', text })
}

/** 某个座位最近一条说书人发的（不算 idle） */
export function lastMessageFor(messages: RoomMessage[], seat: number): RoomMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.seat === seat && m.kind !== 'idle' && m.kind !== 'vote') return m
  }
  return undefined
}

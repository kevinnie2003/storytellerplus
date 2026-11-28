// 说书人这边的联机房间：开房间、自动重连、跟着小镇同步座位数和昼夜、发信息、把玩家的回复记进整局记录
import { create } from 'zustand'
import { game, setGame, useGame } from '../game/store'
import { makeLog } from '../game/log'
import { phaseLabel } from '../game/phase'
import { team2Int } from '../game/loadScript'
import type { Character, GameLogEntry } from '../game/types'
import { uuid } from '../game/uuid'
import { createRoom, fetchRoom, relayURL, RoomSocket, type SocketStatus } from './relay'
import type { FinalInfo, RoleInfo, RoomInfo, RoomMessage, ScriptCharacter, ScriptInfo, ServerMessage, TimerReport, Whisper } from './protocol'
import { settings } from '../settings/store'
import { timerElapsedNow, timerState, useTimerVersion } from '../town/timer'
import { showAlert } from '../ui/Alert'
import { getSubscription } from './push'

interface HostState {
  code: string
  status: SocketStatus | 'off'
  room: RoomInfo | null
  messages: RoomMessage[]
  /** 玩家主动发来的 */
  whispers: Whisper[]
  error: string
  /** 发角色时每个座位的真实角色（座位号 → 角色名）。真实角色变了，说书人要重新发 */
  dealt: Record<number, string>
  /** 说书人的联机面板开着没有 */
  showPanel: boolean
  /** 记事本里“发给”默认选的座位（从夜晚顺序点“发信息”打开时） */
  notepadTarget: number
}

const SAVE_KEY = 'RoomHost'
const DEALT_KEY = 'RoomHostDealt'

export const useHost = create<HostState>(() => ({
  code: '', status: 'off', room: null, messages: [], whispers: [], error: '', dealt: {}, showPanel: false, notepadTarget: -1,
}))

function readDealt(code: string): Record<number, string> {
  try {
    const v = JSON.parse(localStorage.getItem(DEALT_KEY) ?? 'null') as { code: string; dealt: Record<number, string> } | null
    return v && v.code === code ? v.dealt : {}
  } catch { return {} }
}
function writeDealt(code: string, dealt: Record<number, string>) {
  try { localStorage.setItem(DEALT_KEY, JSON.stringify({ code, dealt })) } catch { /* 存不了就算了 */ }
}
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
        message: `发动能力：${m.reply || '（没写）'}`,
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
        message: `选了 ${m.picks.map((p) => `${p + 1}号`).join('、') || '没有人'}`,
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
        message: `${whisperLabel[w.kind]}${w.text ? `：${w.text}` : ''}`,
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
      // 沿用上一局的房间：连上后先清掉上一局的东西
      if (pendingReset !== null) {
        socket?.send({ type: 'reset', reseat: pendingReset })
        pendingReset = null
      }
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

const isNight = (gameState: number) => gameState === 1 || gameState === 3

/** 这一局的剧本（玩家手机上看全部角色能力） */
function scriptInfo(): ScriptInfo {
  const s = game()
  const list = (cs: Character[]): ScriptCharacter[] => cs.filter((c) => c.name).map((c) => ({
    ...roleInfo(c), id: c.id, firstNightOrder: c.firstNightOrder, otherNightOrder: c.otherNightOrder,
  }))
  return { name: s.playName, characters: list(s.playableCharacters), travelers: list(s.travelers), fabled: list(s.fabled) }
}

/** 计时：本局、白天/夜晚各走了多久，计时器的状态。还没开始游戏是 null */
function timerReport(): TimerReport | null {
  const s = game()
  if (s.gameState === 0) return null
  const night = s.gameState === 1 || s.gameState === 3
  const now = Date.now()
  return {
    gameElapsed: now - timerState.gameStartTime,
    phaseElapsed: now - (night ? timerState.nightTimeStart : timerState.dayTimeStart),
    night,
    timerElapsed: timerElapsedNow(now),
    running: !timerState.timerStopped,
    countdown: settings().countdownSeconds,
  }
}
const sendTimer = () => { socket?.send({ type: 'timer', timer: timerReport() }) }

/** 跟着小镇：座位数、第几天第几夜、剧本、计时 */
function watchGame() {
  unsubGame?.()
  let lastScript = ''
  const pushScript = (force = false) => {
    const script = scriptInfo()
    const key = JSON.stringify(script)
    if (!force && key === lastScript) return
    if (socket?.send({ type: 'script', script })) lastScript = key
  }
  const push = () => {
    const s = game()
    pushScript(true)
    socket?.send({ type: 'seats', count: s.playersAssignedCharacters.length })
    socket?.send({ type: 'phase', phase: phaseLabel(s.gameState, s.allLogs), night: s.gameState === 1 || s.gameState === 3 })
    // 谁死了、谁还有死人票是公开的，玩家的座位列表里要显示。
    // 但夜里的死亡要等天亮说书人宣布：夜里不同步，天亮时再一起同步
    if (!isNight(s.gameState)) socket?.send({ type: 'status', alive: s.playersIsAlive, deadVote: s.playersHasDeathVote })
    sendTimer()
  }
  let last = ''
  let lastChars: unknown[] = []
  // 计时器开始、暂停、归零、换白天黑夜时同步一次（平时玩家手机自己走秒）
  const unsubTimer = useTimerVersion.subscribe(() => window.setTimeout(sendTimer, 0))
  const unsubGameOnly = useGame.subscribe((s) => {
    const phase = phaseLabel(s.gameState, s.allLogs)
    const key = `${s.playersAssignedCharacters.length}|${phase}|${s.playersIsAlive.join()}|${s.playersHasDeathVote.join()}`
    if (key !== last) { last = key; push() }
    const chars = [s.playableCharacters, s.travelers, s.fabled, s.playName]
    if (chars.some((c, i) => c !== lastChars[i])) { lastChars = chars; pushScript() }
  })
  unsubGame = () => { unsubGameOnly(); unsubTimer() }
  return push
}

function connect(code: string, hostToken: string) {
  socket?.stop()
  primed = false
  set({ code, error: '', dealt: readDealt(code) })
  const push = watchGame()
  socket = new RoomSocket(
    code,
    () => ({ type: 'hello', hostToken }),
    onMessage,
    (status) => {
      set({ status })
      if (status === 'online') {
        window.setTimeout(push, 50)
        sendVisible()
        void syncHostPush()
      }
    },
  )
}

/** 说书人在不在看魔典：不在看时玩家私信、回复才推送。电脑上切到别的程序也算不在看 */
function sendVisible() {
  socket?.send({ type: 'visible', visible: document.visibilityState === 'visible' && document.hasFocus() })
}
const onVisibility = () => { if (useHost.getState().status === 'online') sendVisible() }
document.addEventListener('visibilitychange', onVisibility)
window.addEventListener('focus', onVisibility)
window.addEventListener('blur', onVisibility)

/** 开了通知的话，把推送订阅交给中转（每次连上都交一次） */
export async function syncHostPush(): Promise<boolean> {
  try {
    const sub = await getSubscription()
    if (!sub) return false
    return !!socket?.send({ type: 'push', sub })
  } catch (e) {
    console.warn('push', e)
    return false
  }
}

/** 沿用上一局的房间时，连上后要发的 reset（null 是不用） */
let pendingReset: boolean | null = null

/** 上一局开过、现在还在的房间（这一局还没开房间时可以接着用） */
export async function previousRoom(): Promise<string> {
  const saved = readSaved()
  if (!saved || saved.gameID === game().gameID || game().gameID === 'demo') return ''
  try { return (await fetchRoom(saved.code)) ? saved.code : '' } catch { return '' }
}

/** 下一局继续用上一局的房间：玩家不用重新输房间号。reseat 是让大家重新选座位（换了座位、人数变了时） */
export function reuseRoom(reseat: boolean) {
  const saved = readSaved()
  if (!saved) return
  writeSaved({ ...saved, gameID: game().gameID })
  writeDealt(saved.code, {})
  pendingReset = reseat
  connect(saved.code, saved.hostToken)
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

/** 结束游戏、AI 复盘好了：把结果和复盘交给中转，玩家手机上显示 */
export async function uploadFinal(final: FinalInfo): Promise<boolean> {
  const saved = readSaved()
  if (!saved || saved.gameID !== game().gameID) return false
  try {
    const res = await fetch(`${relayURL()}/rooms/${saved.code}/final`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saved.hostToken}`, 'Content-Type': 'text/plain' },
      body: JSON.stringify(final),
    })
    return res.ok
  } catch {
    return false
  }
}

export const hostOnline = () => useHost.getState().status === 'online'

type Outgoing = Omit<RoomMessage, 'sentAt' | 'readAt' | 'picks' | 'phase'>

/** 发给一个或几个人（算一步） */
function sendStep(targets: Outgoing | Outgoing[]): boolean {
  const step = uuid()
  const list: Outgoing[] = (Array.isArray(targets) ? targets : [targets]).map((t) => ({ ...t, step }))
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
      message: `发给${seat + 1}号：${text}`, messager: 21, type: 3, characterName: '说书人',
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

/**
 * 把角色发到玩家手机上：可以只发给一个人（比如舞蛇人换了恶魔）。
 * actual 是这个座位现在的真实角色，记下来，之后真实角色变了就提醒说书人重新发
 */
export function sendRoles(roles: { seat: number; role: RoleInfo; actual: string }[]): boolean {
  if (!roles.length) return false
  const step = uuid()
  const ok = !!socket?.send({ type: 'send', messages: roles.map(({ seat, role }) => ({ id: uuid(), seat, kind: 'role', text: '', role, step })) })
  if (ok) {
    const { code, dealt } = useHost.getState()
    const next = { ...dealt }
    for (const r of roles) next[r.seat] = r.actual
    writeDealt(code, next)
    set({ dealt: next })
    for (const r of roles) logSent(r.seat, r.role.name === r.actual ? `角色：${r.role.name}` : `角色：${r.role.name}（真实是${r.actual}）`)
  }
  return ok
}

/** 某个座位最近发过的角色（手机上显示的那个） */
export function lastRoleFor(messages: RoomMessage[], seat: number): RoleInfo | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.seat === seat && m.kind === 'role' && !m.cancelled) return m.role
  }
  return undefined
}

/** 真实角色和发角色时不一样的座位（已入座的才算） */
export function changedRoleSeats(dealt: Record<number, string>, players: Character[], room: RoomInfo | null): number[] {
  return players.map((c, i) => (room?.seats[i]?.taken && dealt[i] !== undefined && dealt[i] !== c.name ? i : -1)).filter((i) => i >= 0)
}

/** 某个座位最近一条说书人发的 */
export function lastMessageFor(messages: RoomMessage[], seat: number): RoomMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.seat === seat && !m.cancelled) return m
  }
  return undefined
}

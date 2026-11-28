// 玩家这边的联机：用房间号连上，选座位，收说书人的信息，回复已读和选择
import { create } from 'zustand'
import { RoomSocket, type SocketStatus } from './relay'
import type { RoomInfo, RoomMessage, ServerMessage, Whisper, WhisperKind } from './protocol'
import { uuid } from '../game/uuid'

interface PlayerState {
  code: string
  status: SocketStatus | 'off'
  room: RoomInfo | null
  /** 入座了就是座位号（从 0 开始），没有就是 -1 */
  seat: number
  name: string
  inbox: RoomMessage[]
  /** 自己发给说书人的 */
  sent: Whisper[]
  error: string
}

const SAVE_KEY = 'RoomPlayer'
interface Saved { code: string; seatToken: string }
function readSaved(): Saved | null {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as Saved | null } catch { return null }
}
function writeSaved(v: Saved | null) {
  try { if (v) localStorage.setItem(SAVE_KEY, JSON.stringify(v)); else localStorage.removeItem(SAVE_KEY) } catch { /* 存不了就算了 */ }
}

export const usePlayer = create<PlayerState>(() => ({ code: '', status: 'off', room: null, seat: -1, name: '', inbox: [], sent: [], error: '' }))
const set = (patch: Partial<PlayerState>) => usePlayer.setState(patch)

let socket: RoomSocket | null = null
let seatToken = ''

/** 上次加入的房间（开始页上显示“回到房间”） */
export const savedPlayerRoom = () => readSaved()?.code ?? ''

function onMessage(msg: ServerMessage) {
  switch (msg.type) {
    case 'room':
      set({ room: msg.room })
      return
    case 'seated':
      seatToken = msg.seatToken
      writeSaved({ code: usePlayer.getState().code, seatToken })
      set({ seat: msg.seat, name: msg.name, error: '' })
      return
    case 'inbox':
      set({ inbox: msg.messages, sent: msg.sent ?? [] })
      return
    case 'kicked':
      seatToken = ''
      writeSaved(null)
      set({ seat: -1, inbox: [], sent: [], error: '说书人清空了你的座位，请重新选座位' })
      return
    case 'error':
      if (msg.code === 'bad-token') {
        seatToken = ''
        writeSaved(null)
        set({ seat: -1, inbox: [], sent: [], error: msg.message })
      } else if (msg.code === 'no-room' || msg.code === 'closed') {
        leaveRoom()
        set({ error: msg.message })
      } else {
        set({ error: msg.message })
      }
  }
}

/** 连上房间：带着上次的座位口令就直接回到原座位 */
export function joinRoom(code: string) {
  socket?.stop()
  const saved = readSaved()
  seatToken = saved && saved.code === code ? saved.seatToken : ''
  set({ code, room: null, seat: -1, inbox: [], sent: [], error: '' })
  socket = new RoomSocket(
    code,
    () => (seatToken ? { type: 'hello', seatToken } : { type: 'hello' }),
    onMessage,
    (status) => set({ status }),
  )
}

export function claimSeat(seat: number, name: string) {
  set({ error: '' })
  socket?.send({ type: 'claim', seat, name })
}

export function ackMessage(id: string) {
  socket?.send({ type: 'ack', id })
}

export function answerVote(id: string, yes: boolean) {
  socket?.send({ type: 'answer', id, yes })
}

/** 发给说书人：文字、申请发动能力、申请私聊 */
export function sendWhisper(kind: WhisperKind, text: string): boolean {
  return !!socket?.send({ type: 'whisper', id: uuid(), kind, text })
}

/** 回复说书人“请你发动能力”，空字符串就是这次不发动 */
export function replyMessage(id: string, text: string) {
  socket?.send({ type: 'reply', id, text })
}

export function respondMessage(id: string, picks: number[]) {
  socket?.send({ type: 'respond', id, picks })
}

/** 离开房间：让出座位、断开 */
export function leaveRoom(freeSeat = false) {
  if (freeSeat) socket?.send({ type: 'leave' })
  window.setTimeout(() => { socket?.stop(); socket = null }, freeSeat ? 150 : 0)
  seatToken = ''
  writeSaved(null)
  set({ code: "", status: "off", room: null, seat: -1, inbox: [], sent: [] })
}

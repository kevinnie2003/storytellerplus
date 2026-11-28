// 联机系统的消息格式：网页（说书人、玩家）和中转服务（relay/）共用这一份

/** 发给玩家的一条东西 */
export type MessageKind =
  /** 说书人发的文字信息 */
  | 'text'
  /** 让玩家选几个座位 */
  | 'choose'
  /** 告诉玩家他的角色 */
  | 'role'
  /** 全员同步：这一步没有你的事，点一下确认就行 */
  | 'idle'
  /** 白天投票：轮到你了，投还是不投 */
  | 'vote'

export interface RoleInfo {
  name: string
  ability: string
  imageURL: string
  team: string
}

export interface RoomMessage {
  id: string
  seat: number
  kind: MessageKind
  /** 文字信息的内容，或者选人时的提示 */
  text: string
  /** 选几个人 */
  count?: number
  role?: RoleInfo
  /** 同一次唤醒发出去的一批（包括全员同步的 idle）用同一个 step */
  step?: string
  /** 第几夜、第几天，发的时候说书人那边的阶段 */
  phase: string
  sentAt: number
  readAt?: number
  /** 玩家选的座位（从 0 开始） */
  picks?: number[]
  /** 投票：补充说明（比如死人票） */
  note?: string
  /** 投票：true 投，false 不投 */
  answer?: boolean
  /** 说书人收回了（比如跳过这一位），玩家那边不再显示 */
  cancelled?: boolean
}

/** 玩家主动发给说书人的：文字、申请发动能力、申请私聊 */
export type WhisperKind = 'text' | 'ability' | 'talk'

export interface Whisper {
  id: string
  seat: number
  kind: WhisperKind
  text: string
  phase: string
  sentAt: number
  /** 说书人看过了 */
  readAt?: number
}

export interface SeatInfo {
  /** 有人坐了 */
  taken: boolean
  name: string
  online: boolean
}

/** 房间的公开信息：没加入的人也能看到哪些座位空着 */
export interface RoomInfo {
  code: string
  seats: SeatInfo[]
  /** 说书人那边现在是第几夜、第几天 */
  phase: string
  night: boolean
  hostOnline: boolean
  /** 所有人都看得到的一行进度（比如投票到谁了），没有就是空 */
  banner: string
}

// ——— 网页发给中转 ———
export type ClientMessage =
  | { type: 'hello'; hostToken?: string; seatToken?: string }
  | { type: 'ping' }
  // 玩家（还没入座）
  | { type: 'claim'; seat: number; name: string }
  // 玩家
  | { type: 'ack'; id: string }
  | { type: 'respond'; id: string; picks: number[] }
  | { type: 'answer'; id: string; yes: boolean }
  | { type: 'whisper'; id: string; kind: WhisperKind; text: string }
  | { type: 'leave' }
  // 说书人
  | { type: 'seats'; count: number }
  | { type: 'phase'; phase: string; night: boolean }
  | { type: 'send'; messages: Omit<RoomMessage, 'sentAt' | 'readAt' | 'picks' | 'phase' | 'answer' | 'cancelled'>[] }
  | { type: 'cancel'; ids: string[] }
  | { type: 'banner'; text: string }
  | { type: 'whisperRead'; ids: string[] }
  | { type: 'kick'; seat: number }
  | { type: 'close' }

// ——— 中转发给网页 ———
export type ServerMessage =
  | { type: 'room'; room: RoomInfo }
  | { type: 'error'; code: 'no-room' | 'bad-token' | 'seat-taken' | 'bad-seat' | 'closed'; message: string }
  | { type: 'pong' }
  // 给玩家
  | { type: 'seated'; seat: number; name: string; seatToken: string }
  | { type: 'inbox'; messages: RoomMessage[]; sent?: Whisper[] }
  | { type: 'kicked' }
  // 给说书人
  | { type: 'host'; messages: RoomMessage[]; whispers?: Whisper[] }

/** 房间号用的字符：去掉了 0 O 1 I L 这些容易看错的 */
export const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const CODE_LENGTH = 4

export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, CODE_LENGTH)

// 联机系统的消息格式：网页（说书人、玩家）和中转服务（relay/）共用这一份

/** 发给玩家的一条东西 */
export type MessageKind =
  /** 说书人发的文字信息 */
  | 'text'
  /** 让玩家选几个座位 */
  | 'choose'
  /** 告诉玩家他的角色 */
  | 'role'
  /** 说书人要你发动能力：打字告诉说书人你的选择 */
  | 'ask'

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
  /** 同一次唤醒发出去的一批用同一个 step */
  step?: string
  /** 第几夜、第几天，发的时候说书人那边的阶段 */
  phase: string
  sentAt: number
  readAt?: number
  /** 玩家选的座位（从 0 开始） */
  picks?: number[]
  /** 说书人收回了，玩家那边不再显示 */
  cancelled?: boolean
  /** 发动能力：玩家写的回复 */
  reply?: string
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

export type Winner = 'good' | 'evil'

/** 说书人结束了游戏：哪一方赢了、每个座位是赢是输。version 每次更新复盘就加一 */
export interface EndedInfo {
  winner: Winner
  results: boolean[]
  version: number
}

/**
 * 结束游戏后给玩家看的复盘（GET /rooms/<房间号>/final）：整局存档和 AI 复盘。
 * game 是 GameSaveData，recap 是 RecapData（还没生成是 null）；中转不看里面的内容
 */
export interface FinalInfo {
  winner: Winner
  results: boolean[]
  game: unknown
  recap: unknown
}

/** 说书人那边的计时（中转按自己的时钟换算成时间点，玩家用 serverTime 校准本机时钟） */
export interface TimerInfo {
  /** 本局开始、这个白天/夜晚开始的时间点 */
  gameStart: number
  phaseStart: number
  night: boolean
  /** 计时器：timerAt 那一刻走了 timerElapsed 秒，running 表示还在走；countdown 大于 0 是倒计时的总秒数 */
  timerAt: number
  timerElapsed: number
  running: boolean
  countdown: number
}

/** 说书人发给中转的计时：各项已经走了多久 */
export interface TimerReport {
  gameElapsed: number
  phaseElapsed: number
  night: boolean
  timerElapsed: number
  running: boolean
  countdown: number
}

/** 房间的公开信息：没加入的人也能看到哪些座位空着 */
export interface RoomInfo {
  code: string
  seats: SeatInfo[]
  /** 说书人那边现在是第几夜、第几天 */
  phase: string
  night: boolean
  hostOnline: boolean
  /** 谁活着、谁还有死人票（公开信息，说书人那边同步过来） */
  alive?: boolean[]
  deadVote?: boolean[]
  /** 游戏结束了（没结束是 null） */
  ended?: EndedInfo | null
  /** 计时（还没开始游戏是 null） */
  timer?: TimerInfo | null
  /** 中转发这条消息时的时间，玩家拿来校准本机时钟 */
  serverTime?: number
}

/** 剧本里的一个角色：能力加上夜晚顺序（0 是不在夜里行动） */
export interface ScriptCharacter extends RoleInfo {
  id: string
  firstNightOrder: number
  otherNightOrder: number
}

/** 这一局的剧本：玩家在手机上看到和说书人一样的“全部角色能力” */
export interface ScriptInfo {
  name: string
  /** 剧本角色（说书人那边的 playableCharacters） */
  characters: ScriptCharacter[]
  travelers?: ScriptCharacter[]
  fabled?: ScriptCharacter[]
}

/** 浏览器给的推送订阅（PushSubscription.toJSON()） */
export interface PushSub {
  endpoint: string
  keys: { p256dh: string; auth: string }
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
  | { type: 'whisper'; id: string; kind: WhisperKind; text: string }
  | { type: 'reply'; id: string; text: string }
  | { type: 'leave' }
  /** 开通知：说书人找你、你又不在看这个页面时，推送一条提醒；null 是关掉 */
  | { type: 'push'; sub: PushSub | null }
  /** 页面在不在前台（在看就不推送） */
  | { type: 'visible'; visible: boolean }
  // 说书人
  | { type: 'seats'; count: number }
  | { type: 'phase'; phase: string; night: boolean }
  | { type: 'send'; messages: Omit<RoomMessage, 'sentAt' | 'readAt' | 'picks' | 'phase' | 'cancelled' | 'reply'>[] }
  | { type: 'cancel'; ids: string[] }
  | { type: 'script'; script: ScriptInfo }
  | { type: 'timer'; timer: TimerReport | null }
  /** 下一局继续用这个房间：清掉上一局的信息和结果；reseat 是让大家重新选座位 */
  | { type: 'reset'; reseat: boolean }
  | { type: 'whisperRead'; ids: string[] }
  | { type: 'status'; alive: boolean[]; deadVote: boolean[] }
  | { type: 'kick'; seat: number }
  | { type: 'close' }

// ——— 中转发给网页 ———
export type ServerMessage =
  | { type: 'room'; room: RoomInfo }
  | { type: 'error'; code: 'no-room' | 'bad-token' | 'seat-taken' | 'bad-seat' | 'closed'; message: string }
  | { type: 'pong' }
  | { type: 'script'; script: ScriptInfo | null }
  // 给玩家
  | { type: 'seated'; seat: number; name: string; seatToken: string }
  | { type: 'inbox'; messages: RoomMessage[]; sent?: Whisper[] }
  | { type: 'kicked'; reason?: 'reset' }
  // 给说书人
  | { type: 'host'; messages: RoomMessage[]; whispers?: Whisper[] }

/** 房间号用的字符：去掉了 0 O 1 I L 这些容易看错的 */
export const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const CODE_LENGTH = 4

export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, CODE_LENGTH)

// 说书人普拉斯的联机中转。
// 每个房间是一个 Durable Object：存座位、说书人发的信息、玩家的已读和选择，
// 用 WebSocket 推给说书人和玩家。消息格式见 web/src/net/protocol.ts
import { DurableObject } from 'cloudflare:workers'
import {
  CODE_CHARS, CODE_LENGTH, normalizeCode,
  type ClientMessage, type RoomInfo, type RoomMessage, type ServerMessage, type Whisper,
} from '../../web/src/net/protocol'

export interface Env {
  ROOM: DurableObjectNamespace<Room>
}

const MAX_SEATS = 20
const MAX_MESSAGES = 500
/** 一天没人动的房间就删掉 */
const EXPIRE_MS = 24 * 60 * 60 * 1000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    const parts = url.pathname.split('/').filter(Boolean)

    // 开房间：随机一个没人用的房间号
    if (request.method === 'POST' && parts.length === 1 && parts[0] === 'rooms') {
      const body = (await request.json().catch(() => ({}))) as { seats?: number }
      const seats = Math.max(0, Math.min(MAX_SEATS, Math.floor(body.seats ?? 0)))
      for (let i = 0; i < 30; i++) {
        const code = randomCode()
        const stub = env.ROOM.get(env.ROOM.idFromName(code))
        const res = await stub.init(code, seats)
        if (res) return json({ code, hostToken: res })
      }
      return json({ error: '房间号用完了，请稍后再试' }, 503)
    }

    // /rooms/<房间号> 看房间在不在；/rooms/<房间号>/ws 连上房间
    if (parts[0] === 'rooms' && parts.length >= 2) {
      const code = normalizeCode(parts[1])
      if (code.length !== CODE_LENGTH) return json({ error: '房间号不对' }, 404)
      const stub = env.ROOM.get(env.ROOM.idFromName(code))
      if (parts[2] === 'ws') {
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('需要 WebSocket', { status: 426 })
        return stub.fetch(request)
      }
      const info = await stub.info()
      return info ? json(info) : json({ error: '没有这个房间' }, 404)
    }

    if (url.pathname === '/') return new Response('storyteller relay ok', { headers: cors })
    return json({ error: 'not found' }, 404)
  },
} satisfies ExportedHandler<Env>

interface SeatData { token: string | null; name: string }
interface RoomData {
  code: string
  hostToken: string
  seats: SeatData[]
  phase: string
  night: boolean
  banner?: string
  alive?: boolean[]
  deadVote?: boolean[]
  messages: RoomMessage[]
  whispers?: Whisper[]
  updatedAt: number
}

/** 每条连接自己记着是谁 */
type Who = { role: 'guest' } | { role: 'host' } | { role: 'player'; seat: number }

export class Room extends DurableObject<Env> {
  private data: RoomData | null | undefined

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // 心跳不用叫醒房间
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'))
  }

  private async load(): Promise<RoomData | null> {
    if (this.data === undefined) this.data = (await this.ctx.storage.get<RoomData>('room')) ?? null
    return this.data
  }

  private async save() {
    if (!this.data) return
    this.data.updatedAt = Date.now()
    await this.ctx.storage.put('room', this.data)
    await this.ctx.storage.setAlarm(Date.now() + EXPIRE_MS)
  }

  /** 新开房间：已经有人用这个房间号就返回 null */
  async init(code: string, seats: number): Promise<string | null> {
    if (await this.load()) return null
    const hostToken = crypto.randomUUID()
    this.data = {
      code, hostToken, phase: '', night: false, messages: [], updatedAt: Date.now(),
      seats: Array.from({ length: seats }, () => ({ token: null, name: '' })),
    }
    await this.save()
    return hostToken
  }

  async info(): Promise<RoomInfo | null> {
    const data = await this.load()
    return data ? this.roomInfo(data) : null
  }

  async alarm() {
    const data = await this.load()
    if (data && Date.now() - data.updatedAt < EXPIRE_MS) {
      await this.ctx.storage.setAlarm(data.updatedAt + EXPIRE_MS)
      return
    }
    this.closeAll()
    await this.ctx.storage.deleteAll()
    this.data = null
  }

  async fetch(): Promise<Response> {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ role: 'guest' } satisfies Who)
    return new Response(null, { status: 101, webSocket: client })
  }

  // ——— 连接 ———
  private who(ws: WebSocket): Who {
    return (ws.deserializeAttachment() as Who | null) ?? { role: 'guest' }
  }

  private sockets(except?: WebSocket) {
    return this.ctx.getWebSockets().filter((ws) => ws !== except && ws.readyState === WebSocket.OPEN)
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try { ws.send(JSON.stringify(msg)) } catch { /* 已经断了 */ }
  }

  private roomInfo(data: RoomData, except?: WebSocket): RoomInfo {
    const online = new Set<number>()
    let hostOnline = false
    for (const ws of this.sockets(except)) {
      const w = this.who(ws)
      if (w.role === 'player') online.add(w.seat)
      if (w.role === 'host') hostOnline = true
    }
    return {
      code: data.code,
      phase: data.phase,
      night: data.night,
      banner: data.banner ?? '',
      alive: data.alive ?? [],
      deadVote: data.deadVote ?? [],
      hostOnline,
      seats: data.seats.map((s, i) => ({ taken: s.token !== null, name: s.name, online: online.has(i) })),
    }
  }

  private broadcastRoom(data: RoomData, except?: WebSocket) {
    const room = this.roomInfo(data, except)
    for (const ws of this.sockets(except)) this.send(ws, { type: 'room', room })
  }

  private inbox(data: RoomData, seat: number): RoomMessage[] {
    return data.messages.filter((m) => m.seat === seat)
  }

  private inboxMsg(data: RoomData, seat: number): ServerMessage {
    return { type: 'inbox', messages: this.inbox(data, seat), sent: (data.whispers ?? []).filter((w) => w.seat === seat) }
  }

  private hostMsg(data: RoomData): ServerMessage {
    return { type: 'host', messages: data.messages, whispers: data.whispers ?? [] }
  }

  private pushInbox(data: RoomData, seat: number) {
    const msg = this.inboxMsg(data, seat)
    for (const ws of this.sockets()) {
      const w = this.who(ws)
      if (w.role === 'player' && w.seat === seat) this.send(ws, msg)
    }
  }

  private pushHost(data: RoomData) {
    const msg = this.hostMsg(data)
    for (const ws of this.sockets()) {
      if (this.who(ws).role === 'host') this.send(ws, msg)
    }
  }

  /** 把坐在某个座位上的人请下去（变回没入座） */
  private unseat(seat: number) {
    for (const ws of this.sockets()) {
      const w = this.who(ws)
      if (w.role === 'player' && w.seat === seat) {
        ws.serializeAttachment({ role: 'guest' } satisfies Who)
        this.send(ws, { type: 'kicked' })
      }
    }
  }

  private closeAll() {
    for (const ws of this.sockets()) {
      this.send(ws, { type: 'error', code: 'closed', message: '说书人关掉了房间' })
      try { ws.close(1000, 'closed') } catch { /* 已经断了 */ }
    }
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > 64_000) return
    let msg: ClientMessage
    try { msg = JSON.parse(raw) as ClientMessage } catch { return }
    const data = await this.load()
    if (!data) {
      this.send(ws, { type: 'error', code: 'no-room', message: '没有这个房间，可能已经关掉或者过期了' })
      ws.close(1000, 'no room')
      return
    }
    const who = this.who(ws)

    switch (msg.type) {
      case 'ping':
        this.send(ws, { type: 'pong' })
        return

      case 'hello': {
        if (msg.hostToken) {
          if (msg.hostToken !== data.hostToken) {
            this.send(ws, { type: 'error', code: 'bad-token', message: '不是这个房间的说书人' })
            return
          }
          ws.serializeAttachment({ role: 'host' } satisfies Who)
          this.send(ws, this.hostMsg(data))
          this.broadcastRoom(data)
          return
        }
        if (msg.seatToken) {
          const seat = data.seats.findIndex((s) => s.token === msg.seatToken)
          if (seat < 0) {
            this.send(ws, { type: 'error', code: 'bad-token', message: '你的座位已经被说书人清空了，请重新选座位' })
            this.send(ws, { type: 'room', room: this.roomInfo(data) })
            return
          }
          ws.serializeAttachment({ role: 'player', seat } satisfies Who)
          this.send(ws, { type: 'seated', seat, name: data.seats[seat].name, seatToken: msg.seatToken })
          this.send(ws, this.inboxMsg(data, seat))
          this.broadcastRoom(data)
          return
        }
        this.send(ws, { type: 'room', room: this.roomInfo(data) })
        return
      }

      case 'claim': {
        if (who.role === 'host') return
        const seat = Math.floor(msg.seat)
        if (!(seat >= 0 && seat < data.seats.length)) {
          this.send(ws, { type: 'error', code: 'bad-seat', message: '没有这个座位' })
          return
        }
        if (data.seats[seat].token !== null) {
          this.send(ws, { type: 'error', code: 'seat-taken', message: `${seat + 1}号已经有人了` })
          this.send(ws, { type: 'room', room: this.roomInfo(data) })
          return
        }
        // 换座位：先让出原来的
        if (who.role === 'player') data.seats[who.seat] = { token: null, name: '' }
        const seatToken = crypto.randomUUID()
        data.seats[seat] = { token: seatToken, name: String(msg.name ?? '').slice(0, 20) }
        await this.save()
        ws.serializeAttachment({ role: 'player', seat } satisfies Who)
        this.send(ws, { type: 'seated', seat, name: data.seats[seat].name, seatToken })
        this.send(ws, this.inboxMsg(data, seat))
        this.broadcastRoom(data)
        return
      }

      case 'ack':
      case 'respond':
      case 'reply':
      case 'answer': {
        if (who.role !== 'player') return
        const m = data.messages.find((x) => x.id === msg.id && x.seat === who.seat)
        if (!m || m.cancelled) return
        if (!m.readAt) m.readAt = Date.now()
        if (msg.type === 'respond') {
          m.picks = msg.picks.map((p) => Math.floor(p)).filter((p) => p >= 0 && p < data.seats.length).slice(0, MAX_SEATS)
        }
        if (msg.type === 'answer' && m.kind === 'vote' && m.answer === undefined) m.answer = !!msg.yes
        if (msg.type === 'reply' && m.kind === 'ask') m.reply = String(msg.text ?? '').slice(0, 500)
        await this.save()
        this.pushInbox(data, who.seat)
        this.pushHost(data)
        return
      }

      case 'whisper': {
        if (who.role !== 'player') return
        const list = data.whispers ?? (data.whispers = [])
        if (list.some((w) => w.id === msg.id)) return
        const kind = msg.kind === 'ability' || msg.kind === 'talk' ? msg.kind : 'text'
        list.push({ id: String(msg.id).slice(0, 64), seat: who.seat, kind, text: String(msg.text ?? '').slice(0, 500), phase: data.phase, sentAt: Date.now() })
        if (list.length > MAX_MESSAGES) data.whispers = list.slice(-MAX_MESSAGES)
        await this.save()
        this.pushInbox(data, who.seat)
        this.pushHost(data)
        return
      }

      case 'leave': {
        if (who.role !== 'player') return
        data.seats[who.seat] = { token: null, name: '' }
        await this.save()
        ws.serializeAttachment({ role: 'guest' } satisfies Who)
        this.broadcastRoom(data)
        return
      }

      // ——— 说书人 ———
      case 'seats': {
        if (who.role !== 'host') return
        const count = Math.max(0, Math.min(MAX_SEATS, Math.floor(msg.count)))
        for (let i = count; i < data.seats.length; i++) if (data.seats[i].token) this.unseat(i)
        data.seats = Array.from({ length: count }, (_, i) => data.seats[i] ?? { token: null, name: '' })
        await this.save()
        this.broadcastRoom(data)
        return
      }

      case 'phase': {
        if (who.role !== 'host') return
        data.phase = String(msg.phase).slice(0, 20)
        data.night = !!msg.night
        await this.save()
        this.broadcastRoom(data)
        return
      }

      case 'send': {
        if (who.role !== 'host') return
        const now = Date.now()
        const seats = new Set<number>()
        for (const m of msg.messages.slice(0, MAX_SEATS * 2)) {
          if (!(m.seat >= 0 && m.seat < data.seats.length)) continue
          data.messages.push({
            id: String(m.id).slice(0, 64), seat: m.seat, kind: m.kind, text: String(m.text ?? '').slice(0, 2000),
            count: m.count, role: m.role, step: m.step, note: m.note ? String(m.note).slice(0, 200) : undefined, phase: data.phase, sentAt: now,
          })
          seats.add(m.seat)
        }
        if (data.messages.length > MAX_MESSAGES) data.messages = data.messages.slice(-MAX_MESSAGES)
        await this.save()
        for (const seat of seats) this.pushInbox(data, seat)
        this.pushHost(data)
        return
      }

      case 'cancel': {
        if (who.role !== 'host') return
        const ids = new Set(msg.ids)
        const seats = new Set<number>()
        for (const m of data.messages) {
          if (ids.has(m.id) && !m.readAt) { m.cancelled = true; m.readAt = Date.now(); seats.add(m.seat) }
        }
        await this.save()
        for (const seat of seats) this.pushInbox(data, seat)
        this.pushHost(data)
        return
      }

      case 'whisperRead': {
        if (who.role !== 'host') return
        const ids = new Set(msg.ids)
        const seats = new Set<number>()
        for (const w of data.whispers ?? []) {
          if (ids.has(w.id) && !w.readAt) { w.readAt = Date.now(); seats.add(w.seat) }
        }
        await this.save()
        for (const seat of seats) this.pushInbox(data, seat)
        this.pushHost(data)
        return
      }

      case 'status': {
        if (who.role !== 'host') return
        const n = data.seats.length
        data.alive = Array.from({ length: n }, (_, i) => msg.alive?.[i] !== false)
        data.deadVote = Array.from({ length: n }, (_, i) => msg.deadVote?.[i] !== false)
        await this.save()
        this.broadcastRoom(data)
        return
      }

      case 'banner': {
        if (who.role !== 'host') return
        data.banner = String(msg.text ?? '').slice(0, 200)
        await this.save()
        this.broadcastRoom(data)
        return
      }

      case 'kick': {
        if (who.role !== 'host') return
        const seat = Math.floor(msg.seat)
        if (!(seat >= 0 && seat < data.seats.length)) return
        this.unseat(seat)
        data.seats[seat] = { token: null, name: '' }
        await this.save()
        this.broadcastRoom(data)
        return
      }

      case 'close': {
        if (who.role !== 'host') return
        this.closeAll()
        await this.ctx.storage.deleteAll()
        this.data = null
        return
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    const data = await this.load()
    if (data) this.broadcastRoom(data, ws)
  }

  async webSocketError(ws: WebSocket) {
    const data = await this.load()
    if (data) this.broadcastRoom(data, ws)
  }
}

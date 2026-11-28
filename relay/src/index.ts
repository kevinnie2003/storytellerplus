// 说书人普拉斯的联机中转。
// 每个房间是一个 Durable Object：存座位、说书人发的信息、玩家的已读和选择，
// 用 WebSocket 推给说书人和玩家。消息格式见 web/src/net/protocol.ts
import { DurableObject } from 'cloudflare:workers'
import {
  CODE_CHARS, CODE_LENGTH, normalizeCode,
  type ClientMessage, type EndedInfo, type FinalInfo, type MessageKind, type PushSub, type RoomInfo, type RoomMessage, type ScriptCharacter, type ScriptInfo, type ServerMessage, type Whisper,
} from '../../web/src/net/protocol'
import { pushAllowed, sendPush } from './push'

export interface Env {
  ROOM: DurableObjectNamespace<Room>
  /** 推送用的 VAPID 公钥（base64url），私钥是 secret VAPID_PRIVATE_JWK */
  VAPID_PUBLIC?: string
  VAPID_PRIVATE_JWK?: string
}

const MAX_SEATS = 20
const MAX_MESSAGES = 500
/** 一天没人动的房间就删掉 */
const EXPIRE_MS = 24 * 60 * 60 * 1000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      // 结束游戏后的复盘：说书人上传（带说书人口令），玩家读取
      if (parts[2] === 'final') {
        if (request.method === 'POST') {
          const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
          const res = await stub.setFinal(token, await request.text())
          return res === 'ok' ? json({ ok: true }) : json({ error: res }, res === '不是这个房间的说书人' ? 403 : 400)
        }
        const final = await stub.getFinal()
        return final ? new Response(final, { headers: { 'Content-Type': 'application/json', ...cors } }) : json({ error: '还没有复盘' }, 404)
      }
      if (parts[2] === 'ws') {
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('需要 WebSocket', { status: 426 })
        return stub.fetch(request)
      }
      const info = await stub.info()
      return info ? json(info) : json({ error: '没有这个房间' }, 404)
    }

    // 玩家开通知时要用的公钥
    if (url.pathname === '/push-key') return env.VAPID_PUBLIC ? json({ key: env.VAPID_PUBLIC }) : json({ error: '没有设置推送' }, 404)

    if (url.pathname === '/') return new Response('storyteller relay ok', { headers: cors })
    return json({ error: 'not found' }, 404)
  },
} satisfies ExportedHandler<Env>

interface SeatData { token: string | null; name: string; push?: PushSub }
interface RoomData {
  code: string
  hostToken: string
  seats: SeatData[]
  phase: string
  night: boolean
  script?: ScriptInfo
  ended?: EndedInfo
  alive?: boolean[]
  deadVote?: boolean[]
  messages: RoomMessage[]
  whispers?: Whisper[]
  updatedAt: number
}

/** 每条连接自己记着是谁 */
type Who = { role: 'guest' } | { role: 'host' } | { role: 'player'; seat: number; hidden?: boolean }

/** 通知上统一显示这一句，不说是什么事（锁屏上旁边的人也看得到） */
const PUSH_TEXT = '说书人拍了拍你'

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

  /** 说书人结束游戏、或者 AI 复盘好了：存下复盘，告诉所有人。第一次结束时给每个人推送提醒 */
  async setFinal(token: string, body: string): Promise<string> {
    const data = await this.load()
    if (!data) return '没有这个房间'
    if (!token || token !== data.hostToken) return '不是这个房间的说书人'
    if (body.length > 1_800_000) return '复盘太大了'
    let final: FinalInfo
    try { final = JSON.parse(body) as FinalInfo } catch { return '格式不对' }
    if (final.winner !== 'good' && final.winner !== 'evil') return '没有胜利方'
    const first = !data.ended
    const results = Array.from({ length: data.seats.length }, (_, i) => !!final.results?.[i])
    data.ended = { winner: final.winner, results, version: (data.ended?.version ?? 0) + 1 }
    await this.ctx.storage.put('final', JSON.stringify({ ...final, results }))
    await this.save()
    this.broadcastRoom(data)
    if (first) data.seats.forEach((_, seat) => this.notify(data, seat))
    return 'ok'
  }

  async getFinal(): Promise<string | null> {
    if (!(await this.load())) return null
    return (await this.ctx.storage.get<string>('final')) ?? null
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
      alive: data.alive ?? [],
      deadVote: data.deadVote ?? [],
      ended: data.ended ?? null,
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

  /** 这个座位的人现在有没有在看页面（在看就不用推送） */
  private watching(seat: number): boolean {
    return this.sockets().some((ws) => {
      const w = this.who(ws)
      return w.role === 'player' && w.seat === seat && !w.hidden
    })
  }

  /** 给不在看页面的人推送一条提醒；订阅失效了就删掉 */
  private notify(data: RoomData, seat: number) {
    const sub = data.seats[seat]?.push
    if (!sub || this.watching(seat) || !this.env.VAPID_PUBLIC || !this.env.VAPID_PRIVATE_JWK) return
    const task = sendPush(sub, { title: '说书人联机', body: PUSH_TEXT }, this.env.VAPID_PUBLIC, this.env.VAPID_PRIVATE_JWK)
      .then(async (gone) => {
        if (gone && data.seats[seat]?.push?.endpoint === sub.endpoint) {
          delete data.seats[seat].push
          await this.save()
        }
      })
      .catch((e) => console.log('push failed', String(e)))
    this.ctx.waitUntil(task)
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
          this.send(ws, { type: 'script', script: data.script ?? null })
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
        this.send(ws, { type: 'script', script: data.script ?? null })
        this.broadcastRoom(data)
        return
      }

      case 'ack':
      case 'respond':
      case 'reply': {
        if (who.role !== 'player') return
        const m = data.messages.find((x) => x.id === msg.id && x.seat === who.seat)
        if (!m || m.cancelled) return
        if (!m.readAt) m.readAt = Date.now()
        if (msg.type === 'respond') {
          m.picks = msg.picks.map((p) => Math.floor(p)).filter((p) => p >= 0 && p < data.seats.length).slice(0, MAX_SEATS)
        }
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

      case 'push': {
        if (who.role !== 'player') return
        const sub = msg.sub
        if (sub && pushAllowed(sub)) {
          data.seats[who.seat].push = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }
        } else {
          delete data.seats[who.seat].push
        }
        await this.save()
        return
      }

      case 'visible': {
        if (who.role !== 'player') return
        ws.serializeAttachment({ ...who, hidden: !msg.visible } satisfies Who)
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
        const seats = new Map<number, MessageKind>()
        for (const m of msg.messages.slice(0, MAX_SEATS * 2)) {
          if (!(m.seat >= 0 && m.seat < data.seats.length)) continue
          data.messages.push({
            id: String(m.id).slice(0, 64), seat: m.seat, kind: m.kind, text: String(m.text ?? '').slice(0, 2000),
            count: m.count, role: m.role, step: m.step, phase: data.phase, sentAt: now,
          })
          seats.set(m.seat, m.kind)
        }
        if (data.messages.length > MAX_MESSAGES) data.messages = data.messages.slice(-MAX_MESSAGES)
        await this.save()
        for (const seat of seats.keys()) this.pushInbox(data, seat)
        this.pushHost(data)
        for (const seat of seats.keys()) this.notify(data, seat)
        return
      }

      case 'script': {
        if (who.role !== 'host') return
        const s = msg.script
        const clean = (list: ScriptCharacter[] | undefined): ScriptCharacter[] => (Array.isArray(list) ? list : []).slice(0, 120).map((c) => ({
          id: String(c.id ?? '').slice(0, 60), name: String(c.name ?? '').slice(0, 30), ability: String(c.ability ?? '').slice(0, 400),
          imageURL: String(c.imageURL ?? '').slice(0, 300), team: String(c.team ?? '').slice(0, 20),
          firstNightOrder: Number(c.firstNightOrder) || 0, otherNightOrder: Number(c.otherNightOrder) || 0,
        }))
        data.script = { name: String(s?.name ?? '').slice(0, 60), characters: clean(s?.characters), travelers: clean(s?.travelers), fabled: clean(s?.fabled) }
        await this.save()
        for (const ws of this.sockets()) {
          if (this.who(ws).role === 'player') this.send(ws, { type: 'script', script: data.script })
        }
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

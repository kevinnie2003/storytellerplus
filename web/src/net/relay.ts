// 连联机中转（relay/）：开房间的 HTTP 请求，加上一条会自动重连的 WebSocket
import type { ClientMessage, RoomInfo, ServerMessage } from './protocol'

/**
 * 中转服务的地址：构建时用 VITE_RELAY_URL；本机开发时用同一台电脑的 8787 端口（relay 的 npm run dev）
 */
export function relayURL(): string | null {
  const env = (import.meta.env.VITE_RELAY_URL as string | undefined)?.replace(/\/$/, '')
  if (env) return env
  const host = location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.endsWith('.local')) {
    return `http://${host}:8787`
  }
  return null
}

export class RelayError extends Error {}

const need = () => {
  const url = relayURL()
  if (!url) throw new RelayError('联机服务还没有设置好')
  return url
}

export async function createRoom(seats: number): Promise<{ code: string; hostToken: string }> {
  let res: Response
  try {
    res = await fetch(`${need()}/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seats }) })
  } catch (e) {
    if (e instanceof RelayError) throw e
    throw new RelayError('连不上联机服务，请检查网络')
  }
  const body = await res.json().catch(() => ({})) as { code?: string; hostToken?: string; error?: string }
  if (!res.ok || !body.code || !body.hostToken) throw new RelayError(body.error ?? '开房间失败')
  return { code: body.code, hostToken: body.hostToken }
}

export async function fetchRoom(code: string): Promise<RoomInfo | null> {
  let res: Response
  try {
    res = await fetch(`${need()}/rooms/${encodeURIComponent(code)}`)
  } catch (e) {
    if (e instanceof RelayError) throw e
    throw new RelayError('连不上联机服务，请检查网络')
  }
  if (res.status === 404) return null
  if (!res.ok) throw new RelayError('读取房间失败')
  return await res.json() as RoomInfo
}

export type SocketStatus = 'connecting' | 'online' | 'offline' | 'closed'

/**
 * 一条连到房间的 WebSocket。断了自动重连（1 秒起，最多隔 10 秒），每次连上都先发 hello 表明身份。
 * 手机锁屏回来、网络恢复时马上重连
 */
export class RoomSocket {
  private ws: WebSocket | null = null
  private retry = 0
  private timer = 0
  private pinger = 0
  private stopped = false
  private readonly code: string
  private readonly hello: () => ClientMessage
  private readonly onMessage: (msg: ServerMessage) => void
  private readonly onStatus: (s: SocketStatus) => void

  constructor(code: string, hello: () => ClientMessage, onMessage: (msg: ServerMessage) => void, onStatus: (s: SocketStatus) => void) {
    this.code = code
    this.hello = hello
    this.onMessage = onMessage
    this.onStatus = onStatus
    document.addEventListener('visibilitychange', this.wake)
    window.addEventListener('online', this.wake)
    window.addEventListener('pageshow', this.wake)
    this.connect()
  }

  private wake = () => {
    if (this.stopped || document.visibilityState === 'hidden') return
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      this.retry = 0
      window.clearTimeout(this.timer)
      this.connect()
    } else if (this.ws.readyState === WebSocket.OPEN) {
      // 锁屏回来时连接可能已经是假的，发一次 ping 试试
      this.raw({ type: 'ping' })
    }
  }

  private connect() {
    if (this.stopped) return
    const base = relayURL()
    if (!base) { this.onStatus('offline'); return }
    this.onStatus('connecting')
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/rooms/${encodeURIComponent(this.code)}/ws`)
    this.ws = ws
    ws.onopen = () => {
      this.retry = 0
      this.raw(this.hello())
      this.onStatus('online')
      window.clearInterval(this.pinger)
      this.pinger = window.setInterval(() => this.raw({ type: 'ping' }), 20_000)
    }
    ws.onmessage = (e) => {
      try { this.onMessage(JSON.parse(String(e.data)) as ServerMessage) } catch { /* 不认识的消息 */ }
    }
    ws.onclose = () => {
      window.clearInterval(this.pinger)
      if (this.ws !== ws) return
      this.ws = null
      if (this.stopped) return
      this.onStatus('offline')
      const delay = Math.min(10_000, 1000 * 2 ** this.retry)
      this.retry++
      this.timer = window.setTimeout(() => this.connect(), delay)
    }
    ws.onerror = () => { try { ws.close() } catch { /* 已经断了 */ } }
  }

  private raw(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  /** 发出去；没连上就返回 false */
  send(msg: ClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify(msg))
    return true
  }

  stop() {
    this.stopped = true
    window.clearTimeout(this.timer)
    window.clearInterval(this.pinger)
    document.removeEventListener('visibilitychange', this.wake)
    window.removeEventListener('online', this.wake)
    window.removeEventListener('pageshow', this.wake)
    try { this.ws?.close() } catch { /* 已经断了 */ }
    this.ws = null
    this.onStatus('closed')
  }
}

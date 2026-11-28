// 发请求给 Claude 或 OpenAI 兼容接口，对应 iPad 版 AI/AIClient.swift
// 网页版的请求直接从浏览器发出：Claude 要带 anthropic-dangerous-direct-browser-access 才允许跨域；
// 有的提供商根本不允许网页跨域调用，这时 fetch 直接失败，报 network 错误
import { AISettings, type AIConfig } from './providers'
import { uuid } from '../game/uuid'

export interface AIChatMessage {
  id: string
  /** "user" 或 "assistant" */
  role: 'user' | 'assistant'
  text: string
  /** 界面上显示的文字；不填就显示 text（预设问题的提示词很长，只显示它的标题） */
  display?: string
}

export const chatMessage = (role: 'user' | 'assistant', text: string, display?: string): AIChatMessage =>
  ({ id: uuid(), role, text, display })

export type AIErrorKind = 'notConfigured' | 'badURL' | 'http' | 'refusal' | 'empty' | 'truncated' | 'badFormat' | 'network'

export class AIError extends Error {
  kind: AIErrorKind
  code: number
  detail: string
  constructor(kind: AIErrorKind, detail = '', code = 0) {
    super(AIError.describe(kind, detail, code))
    this.kind = kind
    this.code = code
    this.detail = detail
  }

  static describe(kind: AIErrorKind, detail: string, code: number): string {
    switch (kind) {
      case 'notConfigured': return '还没有配置 AI。请先在 AI 设置里填写 API Key 和模型。'
      case 'badURL': return '接口地址不正确，请检查 AI 设置。'
      case 'http':
        if (code === 401 || code === 403) return `API Key 无效或没有权限（${code}）：${detail}`
        if (code === 429) return `请求太频繁或额度不足（429）：${detail}`
        return `请求失败（${code}）：${detail}`
      case 'refusal': return '模型拒绝了这次请求，可以换个说法或换个模型再试。'
      case 'empty': return '模型没有返回内容，请重试。'
      case 'truncated': return '模型的回复太长被截断了，请重试或换一个模型。'
      case 'badFormat': return `模型返回的格式不对：${detail}`
      case 'network': return detail
    }
  }
}

/** 出错时给界面显示的文字 */
export function aiErrorText(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

export function trimmedBase(base: string): string {
  let s = base.trim()
  while (s.endsWith('/')) s = s.slice(0, -1)
  return s
}

function makeURL(s: string): URL | null {
  try { return new URL(s) } catch { return null }
}

function errorMessage(json: unknown, raw: string): string {
  const j = json as Record<string, unknown> | null
  if (j && typeof j === 'object') {
    const err = j.error as Record<string, unknown> | string | undefined
    if (err && typeof err === 'object' && typeof err.message === 'string') return err.message
    if (typeof err === 'string') return err
    if (typeof j.message === 'string') return j.message
  }
  return Array.from(raw).slice(0, 300).join('')
}

function parseJSON(text: string): unknown {
  try { return JSON.parse(text) } catch { return null }
}

/** fetch 本身失败（没收到任何响应）：多半是提供商不允许网页跨域调用，或者网络不通 */
async function doFetch(url: URL, init: RequestInit, cfg: AIConfig): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new AIError('network', '网络没有连接，请联网后重试。')
    }
    throw new AIError('network',
      `连不上 ${url.host}：${cfg.provider.name} 可能不允许从网页直接调用（浏览器的跨域限制），也可能是网络不通。` +
      '网页版请换一个允许网页调用的提供商（例如 Claude、OpenRouter），或者在 AI 设置里把接口地址换成支持跨域的代理。')
  }
}

function anthropicHeaders(cfg: AIConfig): Record<string, string> {
  return {
    'x-api-key': cfg.apiKey,
    'anthropic-version': '2026-10-21',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

function messagesPayload(messages: AIChatMessage[], imageJPEG: string | null | undefined, anthropic: boolean): Record<string, unknown>[] {
  return messages.map((m, i) => {
    if (i === 0 && imageJPEG) {
      if (anthropic) {
        return {
          role: m.role, content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageJPEG } },
            { type: 'text', text: m.text },
          ],
        }
      }
      return {
        role: m.role, content: [
          { type: 'text', text: m.text },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageJPEG}` } },
        ],
      }
    }
    return { role: m.role, content: m.text }
  })
}

export interface SendOptions {
  system: string
  messages: AIChatMessage[]
  /** 图片的 JPEG，base64（不带 data: 前缀），附在第一条用户消息上 */
  imageJPEG?: string | null
  maxTokens?: number
  thorough?: boolean
  config?: AIConfig
}

/** 发送一次对话，返回模型的文字回复。图片会附在第一条用户消息上。 */
export async function aiSend(o: SendOptions): Promise<string> {
  const cfg = o.config ?? AISettings.config
  if (cfg.apiKey === '' || cfg.model === '') throw new AIError('notConfigured')
  try {
    if (cfg.provider.style === 'anthropic') return await sendAnthropic(cfg, o)
    return await sendOpenAI(cfg, o)
  } catch (e) {
    if (e instanceof AIError && e.kind === 'http' && o.imageJPEG && e.code === 400) {
      throw new AIError('http', e.detail + '（这个模型可能不支持图片输入，请换一个支持图片的模型）', 400)
    }
    throw e
  }
}

/** 拼好 Claude Messages API 的请求，单独拿出来方便检查 */
export function buildAnthropicRequest(cfg: AIConfig, o: SendOptions & { stream?: boolean; effort?: string | null; wantThinking?: boolean }) {
  const url = makeURL(trimmedBase(cfg.baseURL) + '/v1/messages')
  if (!url) throw new AIError('badURL')
  const official = url.hostname.endsWith('anthropic.com')
  const body: Record<string, unknown> = o.stream
    ? { model: cfg.model, stream: true, max_tokens: o.maxTokens ?? 32000, messages: messagesPayload(o.messages, o.imageJPEG, true) }
    : { model: cfg.model, max_tokens: o.maxTokens ?? 16000, messages: messagesPayload(o.messages, o.imageJPEG, true) }
  if (o.system !== '') body.system = o.system
  if (o.stream) {
    if (o.effort && official) body.output_config = { effort: o.effort }
    // 让 Claude 把思考过程的摘要也流式发回来，用来显示进度。旧型号不支持这种写法，跳过。
    const model = cfg.model.toLowerCase()
    const oldModel = model.includes('haiku-4') || model.includes('-4-5') || model.includes('-4-1') || model.includes('-3-')
    if (o.wantThinking && official && !oldModel) body.thinking = { type: 'adaptive', display: 'summarized' }
  } else if (o.thorough && official) {
    // 配版这类要反复权衡的任务，让 Claude 用更高的思考强度。只对官方接口发这个参数，第三方的 Claude 兼容接口不一定认识它。
    body.output_config = { effort: 'high' }
  }
  return {
    url,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...anthropicHeaders(cfg) },
      body: JSON.stringify(body),
    } satisfies RequestInit,
    body,
  }
}

/** 拼好 OpenAI 兼容接口的请求 */
export function buildOpenAIRequest(cfg: AIConfig, o: SendOptions & { stream?: boolean }) {
  const url = cfg.baseURL === '' ? null : makeURL(trimmedBase(cfg.baseURL) + '/chat/completions')
  if (!url) throw new AIError('badURL')
  const msgs: Record<string, unknown>[] = []
  if (o.system !== '') msgs.push({ role: 'system', content: o.system })
  msgs.push(...messagesPayload(o.messages, o.imageJPEG, false))
  const body: Record<string, unknown> = { model: cfg.model, messages: msgs, stream: !!o.stream }
  body[cfg.provider.usesMaxCompletionTokens ? 'max_completion_tokens' : 'max_tokens'] = o.maxTokens ?? (o.stream ? 32000 : 16000)
  return {
    url,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
    } satisfies RequestInit,
    body,
  }
}

async function sendAnthropic(cfg: AIConfig, o: SendOptions): Promise<string> {
  const { url, init } = buildAnthropicRequest(cfg, o)
  const resp = await doFetch(url, init, cfg)
  const raw = await resp.text()
  const json = parseJSON(raw) as Record<string, unknown> | null
  if (resp.status !== 200) throw new AIError('http', errorMessage(json, raw), resp.status)
  const stop = typeof json?.stop_reason === 'string' ? json.stop_reason : ''
  if (stop === 'refusal') throw new AIError('refusal')
  if (stop === 'max_tokens') throw new AIError('truncated')
  const blocks = Array.isArray(json?.content) ? (json.content as Record<string, unknown>[]) : []
  const text = blocks.filter((b) => b?.type === 'text').map((b) => (typeof b.text === 'string' ? b.text : '')).join('')
  if (text === '') throw new AIError('empty')
  return text
}

async function sendOpenAI(cfg: AIConfig, o: SendOptions): Promise<string> {
  const { url, init } = buildOpenAIRequest(cfg, o)
  const resp = await doFetch(url, init, cfg)
  const raw = await resp.text()
  const json = parseJSON(raw) as Record<string, unknown> | null
  if (resp.status !== 200) throw new AIError('http', errorMessage(json, raw), resp.status)
  const choice = (Array.isArray(json?.choices) ? json.choices[0] : undefined) as Record<string, unknown> | undefined
  const message = choice?.message as Record<string, unknown> | undefined
  if (choice?.finish_reason === 'length') throw new AIError('truncated')
  let text = typeof message?.content === 'string' ? message.content : ''
  if (text === '' && Array.isArray(message?.content)) {
    text = (message.content as Record<string, unknown>[]).map((p) => (typeof p?.text === 'string' ? p.text : '')).join('')
  }
  if (text === '') throw new AIError('empty')
  return text
}

// MARK: 流式请求

export interface StreamOptions extends SendOptions {
  /** 只对 Claude 官方接口生效，可以是 "low"、"medium"、"high" */
  effort?: string | null
  onThinking?: (thinking: string) => void
  onProgress: (text: string) => void
  signal?: AbortSignal
}

/** 把 SSE 的事件一条条交出来（只看 data: 行），给流式请求和测试共用 */
export class SSEParser {
  private buffer = ''
  private decoder = new TextDecoder()
  /** 喂进一段字节，返回这段里完整的 data 负载 */
  push(chunk: Uint8Array | string, end = false): string[] {
    this.buffer += typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: !end })
    const lines = this.buffer.split('\n')
    this.buffer = end ? '' : (lines.pop() ?? '')
    const out: string[] = []
    for (let line of lines) {
      if (line.endsWith('\r')) line = line.slice(0, -1)
      if (!line.startsWith('data:')) continue
      out.push(line.slice(5).trim())
    }
    return out
  }
}

/** 流式的状态：一条条事件喂进来，累积文字、思考和结束原因 */
export class StreamAccumulator {
  text = ''
  thinking = ''
  stop = ''
  done = false
  private isAnthropic: boolean
  constructor(isAnthropic: boolean) { this.isAnthropic = isAnthropic }
  /** 处理一条 data 负载。遇到错误事件会抛出 */
  handle(payload: string) {
    if (payload === '[DONE]') {
      this.done = true
      return
    }
    const event = parseJSON(payload) as Record<string, unknown> | null
    if (!event || typeof event !== 'object' || Array.isArray(event)) return
    if (this.isAnthropic) {
      const type = typeof event.type === 'string' ? event.type : ''
      const delta = event.delta as Record<string, unknown> | undefined
      if (type === 'content_block_delta' && delta && delta.type === 'text_delta') {
        this.text += typeof delta.text === 'string' ? delta.text : ''
      } else if (type === 'content_block_delta' && delta && delta.type === 'thinking_delta') {
        this.thinking += typeof delta.thinking === 'string' ? delta.thinking : ''
      } else if (type === 'message_delta' && delta && typeof delta === 'object') {
        if (typeof delta.stop_reason === 'string') this.stop = delta.stop_reason
      } else if (type === 'error') {
        throw new AIError('http', errorMessage(event, payload), 0)
      }
    } else {
      if (event.error != null) throw new AIError('http', errorMessage(event, payload), 0)
      const choice = (Array.isArray(event.choices) ? event.choices[0] : undefined) as Record<string, unknown> | undefined
      if (choice) {
        const delta = choice.delta as Record<string, unknown> | undefined
        if (delta && typeof delta === 'object') {
          if (typeof delta.content === 'string') this.text += delta.content
          if (typeof delta.reasoning_content === 'string') this.thinking += delta.reasoning_content
        }
        if (typeof choice.finish_reason === 'string') this.stop = choice.finish_reason
      }
    }
  }
  /** 结束后检查结束原因，返回完整回复 */
  finish(): string {
    if (this.stop === 'refusal') throw new AIError('refusal')
    if (this.stop === 'max_tokens' || this.stop === 'length') throw new AIError('truncated')
    if (this.text === '') throw new AIError('empty')
    return this.text
  }
}

/** 流式发送，边生成边通过 onProgress 回报目前已经写出的全部文字，结束后返回完整回复。 */
export async function aiSendStreaming(o: StreamOptions): Promise<string> {
  const cfg = o.config ?? AISettings.config
  if (cfg.apiKey === '' || cfg.model === '') throw new AIError('notConfigured')
  const isAnthropic = cfg.provider.style === 'anthropic'
  if (cfg.baseURL === '') throw new AIError('badURL')
  const opts = { ...o, stream: true, maxTokens: o.maxTokens ?? 32000 }
  const { url, init } = isAnthropic
    ? buildAnthropicRequest(cfg, { ...opts, wantThinking: o.onThinking != null })
    : buildOpenAIRequest(cfg, opts)
  const resp = await doFetch(url, { ...init, signal: o.signal }, cfg)
  if (resp.status !== 200) {
    let raw = ''
    try { raw = (await resp.text()).slice(0, 20000) } catch { /* 读不出来就算了 */ }
    let message = errorMessage(parseJSON(raw), raw)
    if (o.imageJPEG && resp.status === 400) message += '（这个模型可能不支持图片输入，请换一个支持图片的模型）'
    throw new AIError('http', message, resp.status)
  }
  if (!resp.body) throw new AIError('empty')

  const parser = new SSEParser()
  const acc = new StreamAccumulator(isAnthropic)
  let lastReport = 0
  const reader = resp.body.getReader()
  const report = () => {
    if (Date.now() - lastReport > 250) {
      lastReport = Date.now()
      if (acc.text === '' && o.onThinking && acc.thinking !== '') o.onThinking(acc.thinking)
      else o.onProgress(acc.text)
    }
  }
  try {
    outer: for (;;) {
      const { value, done } = await reader.read()
      const payloads = parser.push(value ?? new Uint8Array(), done)
      for (const p of payloads) {
        acc.handle(p)
        if (acc.done) break outer
        report()
      }
      if (done) break
    }
  } catch (e) {
    if (e instanceof AIError) throw e
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new AIError('network', `连接中断了，请重试。（${aiErrorText(e)}）`)
  } finally {
    reader.cancel().catch(() => {})
  }
  const final = acc.finish()
  o.onProgress(final)
  return final
}

/** 向提供商查询可用的模型 ID */
export async function aiListModels(cfg: AIConfig): Promise<string[]> {
  const path = cfg.provider.style === 'anthropic' ? '/v1/models?limit=100' : '/models'
  const url = cfg.baseURL === '' ? null : makeURL(trimmedBase(cfg.baseURL) + path)
  if (!url) throw new AIError('badURL')
  const headers: Record<string, string> = cfg.provider.style === 'anthropic'
    ? anthropicHeaders(cfg)
    : { Authorization: `Bearer ${cfg.apiKey}` }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30000)
  try {
    const resp = await doFetch(url, { headers, signal: ctrl.signal }, cfg)
    const raw = await resp.text()
    const json = parseJSON(raw) as Record<string, unknown> | null
    if (resp.status !== 200) throw new AIError('http', errorMessage(json, raw), resp.status)
    const list = Array.isArray(json?.data) ? (json.data as Record<string, unknown>[]) : []
    return list.map((m) => m?.id).filter((id): id is string => typeof id === 'string')
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new AIError('network', '请求超时，请检查网络或接口地址。')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

// MARK: 从回复里取 JSON

/**
 * 从模型回复里取出 JSON。容忍：前后的说明文字、``` 代码块、说明文字里出现的方括号（如“[+1 外来者]”）、
 * 字符串里没有转义的英文双引号、结尾多余的逗号。
 */
export function aiExtractJSON(text: string): unknown {
  // 去掉代码块标记
  const body = text.split('```json').join('').split('```JSON').join('').split('```').join('')
  const chars = Array.from(body)
  // 从每一个 { 或 [ 开始，找到与之配对的结尾，能解析成对象的就用
  const candidates: string[] = []
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== '{' && chars[i] !== '[') continue
    const end = matchingBracket(chars, i)
    if (end !== null) candidates.push(chars.slice(i, end + 1).join(''))
  }
  // 优先长的（完整的对象），再试短的
  const len = (s: string) => Array.from(s).length
  candidates.sort((a, b) => len(b) - len(a))
  for (const candidate of candidates) {
    const parsed = parseLoose(candidate)
    if (parsed !== undefined) return parsed
  }
  // 配对失败时（常见于字符串里有没转义的引号），退回到“第一个 { 到最后一个 }”再修复
  const start = chars.indexOf('{')
  const end = chars.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const parsed = parseLoose(chars.slice(start, end + 1).join(''))
    return parsed === undefined ? null : parsed
  }
  return null
}

/** 解析，失败时修复常见问题再试一次。都失败返回 undefined */
function parseLoose(text: string): unknown {
  const strict = (t: string): unknown => {
    try {
      const v = JSON.parse(t)
      // JSONSerialization 默认只认对象和数组
      return v !== null && typeof v === 'object' ? v : undefined
    } catch {
      return undefined
    }
  }
  const first = strict(text)
  if (first !== undefined) return first
  return strict(aiRepairJSON(text))
}

/** 找到与 chars[start] 配对的括号位置（跳过字符串里的内容） */
function matchingBracket(chars: string[], start: number): number | null {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < chars.length; i++) {
    const c = chars[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{' || c === '[') depth += 1
    else if (c === '}' || c === ']') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return null
}

/** 修复：字符串内部没转义的英文双引号改成中文引号；去掉 } 或 ] 前多余的逗号 */
export function aiRepairJSON(text: string): string {
  const chars = Array.from(text)
  let out = ''
  let inString = false
  let escaped = false
  let openQuote = true
  const nextNonSpace = (i: number): string | null => {
    for (let j = i + 1; j < chars.length; j++) {
      if (!/\s/u.test(chars[j])) return chars[j]
    }
    return null
  }
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (inString) {
      if (escaped) { escaped = false; out += c; continue }
      if (c === '\\') { escaped = true; out += c; continue }
      if (c === '"') {
        // 结构上的结束引号后面紧跟 : , } ] 或者文本结束
        const next = nextNonSpace(i)
        if (next === null || next === ':' || next === ',' || next === '}' || next === ']') {
          inString = false
          out += c
        } else {
          out += openQuote ? '“' : '”'
          openQuote = !openQuote
        }
        continue
      }
      if (c === '\n') { out += '\\n'; continue }
      out += c
    } else {
      if (c === '"') { inString = true; openQuote = true }
      out += c
    }
  }
  // 去掉多余的结尾逗号
  let cleaned = out
  for (;;) {
    const next = cleaned.replace(/,\s*([}\]])/, '$1')
    if (next === cleaned) break
    cleaned = next
  }
  return cleaned
}

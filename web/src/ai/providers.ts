// AI 提供商、设置和密钥存储，对应 iPad 版 AI/AIProvider.swift
//
// 网页版存在浏览器的 localStorage 里（iPad 版的模型和地址在 UserDefaults，Key 在钥匙串）。键名：
//   ai.providerID        当前选的提供商 id，默认 "anthropic"
//   ai.model.<id>        这个提供商选的模型 ID，空就用默认模型列表的第一个
//   ai.baseURL.<id>      这个提供商的接口地址，空就用默认地址
//   ai.apiKey.<id>       这个提供商的 API Key（只存在这个浏览器里，请求直接从浏览器发给提供商）
//   ai.lastBadReply      最近一次解析失败的模型原文，方便排查（对应 iPad 的 ai-last-bad-reply.txt）
// 值都是原样的字符串，不是 JSON。
import { create } from 'zustand'

export type AIAPIStyle = 'anthropic' | 'openAI'

export interface AIProvider {
  id: string
  name: string
  style: AIAPIStyle
  defaultBaseURL: string
  defaultModels: string[]
  usesMaxCompletionTokens?: boolean
  note: string
}

export const aiProviders: AIProvider[] = [
  {
    id: 'anthropic', name: 'Claude (Anthropic)', style: 'anthropic',
    defaultBaseURL: 'https://api.anthropic.com',
    defaultModels: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'],
    note: '支持图片。在 platform.claude.com 创建 API Key。',
  },
  {
    id: 'deepseek', name: 'DeepSeek', style: 'openAI',
    defaultBaseURL: 'https://api.deepseek.com',
    defaultModels: ['deepseek-v4-pro', 'deepseek-flash'],
    note: '在 platform.deepseek.com 创建 API Key。',
  },
  {
    id: 'openai', name: 'OpenAI', style: 'openAI',
    defaultBaseURL: 'https://api.openai.com/v1',
    defaultModels: [], usesMaxCompletionTokens: true,
    note: '填好 Key 后点“获取模型列表”选择模型。',
  },
  {
    id: 'gemini', name: 'Gemini (Google)', style: 'openAI',
    defaultBaseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModels: [],
    note: '使用 Google 的 OpenAI 兼容接口。填好 Key 后点“获取模型列表”。',
  },
  {
    id: 'qwen', name: '通义千问 (阿里云百炼)', style: 'openAI',
    defaultBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModels: [],
    note: '填好 Key 后点“获取模型列表”选择模型。',
  },
  {
    id: 'moonshot', name: 'Kimi (月之暗面)', style: 'openAI',
    defaultBaseURL: 'https://api.moonshot.cn/v1',
    defaultModels: [],
    note: '填好 Key 后点“获取模型列表”选择模型。',
  },
  {
    id: 'zhipu', name: '智谱 GLM', style: 'openAI',
    defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModels: [],
    note: '填好 Key 后手动填写模型 ID。',
  },
  {
    id: 'openrouter', name: 'OpenRouter', style: 'openAI',
    defaultBaseURL: 'https://openrouter.ai/api/v1',
    defaultModels: [],
    note: '可以用一个 Key 访问多家模型。',
  },
  {
    id: 'custom', name: '自定义 (OpenAI 兼容)', style: 'openAI',
    defaultBaseURL: '',
    defaultModels: [],
    note: '任何兼容 OpenAI Chat Completions 的服务，自己填接口地址和模型 ID。',
  },
]

export interface AIConfig {
  provider: AIProvider
  baseURL: string
  apiKey: string
  model: string
}

function readKey(key: string): string {
  try { return localStorage.getItem(key) ?? '' } catch { return '' }
}

function writeKey(key: string, value: string): boolean {
  try {
    if (value === '') localStorage.removeItem(key)
    else localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

interface AISettingsState {
  providerID: string
  /** 每次改了模型、地址、Key 就加一，让用到的界面重画 */
  version: number
  setProviderID: (id: string) => void
}

export const useAISettings = create<AISettingsState>((set) => ({
  providerID: readKey('ai.providerID') || 'anthropic',
  version: 0,
  setProviderID: (id) => {
    writeKey('ai.providerID', id)
    set((s) => ({ providerID: id, version: s.version + 1 }))
  },
}))

const bump = () => useAISettings.setState((s) => ({ version: s.version + 1 }))

/** 对应 AISettings.shared */
export const AISettings = {
  get providerID() { return useAISettings.getState().providerID },
  set providerID(id: string) { useAISettings.getState().setProviderID(id) },

  get provider(): AIProvider {
    const id = useAISettings.getState().providerID
    return aiProviders.find((p) => p.id === id) ?? aiProviders[0]
  },

  model(p: AIProvider): string {
    const saved = readKey(`ai.model.${p.id}`)
    return saved === '' ? (p.defaultModels[0] ?? '') : saved
  },
  setModel(value: string, p: AIProvider) {
    writeKey(`ai.model.${p.id}`, value.trim())
    bump()
  },

  baseURL(p: AIProvider): string {
    const saved = readKey(`ai.baseURL.${p.id}`)
    return saved === '' ? p.defaultBaseURL : saved
  },
  setBaseURL(value: string, p: AIProvider) {
    writeKey(`ai.baseURL.${p.id}`, value.trim())
    bump()
  },

  apiKey(p: AIProvider): string {
    return readKey(`ai.apiKey.${p.id}`)
  },
  setAPIKey(value: string, p: AIProvider): boolean {
    const ok = writeKey(`ai.apiKey.${p.id}`, value.trim())
    bump()
    return ok
  },

  get config(): AIConfig {
    const p = this.provider
    return { provider: p, baseURL: this.baseURL(p), apiKey: this.apiKey(p), model: this.model(p) }
  },

  get isConfigured(): boolean {
    const c = this.config
    return c.apiKey !== '' && c.model !== '' && c.baseURL !== ''
  },
}

/** 把最近一次解析失败的原文存下来 */
export function aiSaveFailedReply(reply: string) {
  writeKey('ai.lastBadReply', reply)
}

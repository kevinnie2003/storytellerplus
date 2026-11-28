// 设置页“提供商、Key 和模型”下面那行小字，对应 iPad 版 AISettings.shared.isConfigured / provider.name / model(provider)
// 网页版 AI 设置存在 localStorage，键名沿用 iPad 版：ai.providerID、ai.model.<id>、ai.baseURL.<id>；Key 的键名尽量多认几种

const providers: { id: string; name: string; baseURL: string; model: string }[] = [
  { id: 'anthropic', name: 'Claude (Anthropic)', baseURL: 'https://api.anthropic.com', model: 'claude-opus-5-5' },
  { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-pro' },
  { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', model: '' },
  { id: 'gemini', name: 'Gemini (Google)', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '' },
  { id: 'qwen', name: '通义千问 (阿里云百炼)', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: '' },
  { id: 'moonshot', name: 'Kimi (月之暗面)', baseURL: 'https://api.moonshot.cn/v1', model: '' },
  { id: 'zhipu', name: '智谱 GLM', baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: '' },
  { id: 'openrouter', name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1', model: '' },
  { id: 'custom', name: '自定义 (OpenAI 兼容)', baseURL: '', model: '' },
]

/** localStorage 里的字符串，存成 JSON 字符串或者原样字符串都认 */
function readString(key: string): string {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return ''
    try {
      const v = JSON.parse(raw)
      return typeof v === 'string' ? v.trim() : ''
    } catch {
      return raw.trim()
    }
  } catch {
    return ''
  }
}

export function aiSettingsHint(): string {
  const id = readString('ai.providerID') || 'anthropic'
  const p = providers.find((x) => x.id === id) ?? providers[0]
  const model = readString(`ai.model.${p.id}`) || p.model
  const baseURL = readString(`ai.baseURL.${p.id}`) || p.baseURL
  const key = readString(`ai.apiKey.${p.id}`) || readString(`ai.key.${p.id}`) || readString(`storytellerplus.ai.${p.id}`)
  if (!key || !model || !baseURL) return '还没有配置'
  return `${p.name} · ${model}`
}

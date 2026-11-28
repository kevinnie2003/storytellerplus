// AI 设置，对应 iPad 版 AI/AISettingsView.swift（NavigationStack + Form，iPad 上是表单弹窗）
// 存储的键名见 providers.ts 顶部
import { useEffect, useState } from 'react'
import './ai.css'
import { Sheet } from '../ui/Sheet'
import { SFIcon } from '../ui/SFIcon'
import { useCompact } from '../ui/compact'
import { STChoice, STPageHeader, STRow, STSection, rounded } from '../ui/kit'
import { AISettings, aiProviders, useAISettings, type AIConfig } from './providers'
import { aiErrorText, aiListModels, aiSend, chatMessage } from './client'
import { keyboardMargins, useKeyboardInset } from './common'

export function AISettingsView({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} width="min(calc(100vw - 48px), 640px)" height="min(calc(100vh - 48px), 720px)">
      {open ? <AISettingsBody onClose={onClose} /> : null}
    </Sheet>
  )
}

function AISettingsBody({ onClose }: { onClose: () => void }) {
  const providerID = useAISettings((s) => s.providerID)
  const provider = aiProviders.find((p) => p.id === providerID) ?? aiProviders[0]
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [statusOK, setStatusOK] = useState(false)
  const [busy, setBusy] = useState(false)
  const compact = useCompact()
  const keyboard = useKeyboardInset(compact)

  const load = () => {
    const p = AISettings.provider
    setApiKey(AISettings.apiKey(p))
    setModel(AISettings.model(p))
    setBaseURL(AISettings.baseURL(p))
    setFetchedModels([])
    setStatus('')
  }

  useEffect(load, [])

  const modelChoices = (() => {
    const list = [...(fetchedModels.length === 0 ? provider.defaultModels : fetchedModels)]
    if (model !== '' && !list.includes(model)) list.unshift(model)
    return list
  })()

  const currentConfig = (): AIConfig => ({
    provider, baseURL: baseURL.trim(), apiKey: apiKey.trim(), model: model.trim(),
  })

  const save = () => {
    const p = AISettings.provider
    AISettings.setModel(model, p)
    AISettings.setBaseURL(baseURL === p.defaultBaseURL ? '' : baseURL, p)
    if (!AISettings.setAPIKey(apiKey, p)) {
      setStatus('API Key 保存到浏览器失败')
      setStatusOK(false)
    }
  }

  const fetchModels = async () => {
    setBusy(true)
    try {
      const list = await aiListModels(currentConfig())
      setFetchedModels([...list].sort())
      setStatus(`获取到 ${list.length} 个模型`)
      setStatusOK(true)
    } catch (e) {
      setStatus(aiErrorText(e))
      setStatusOK(false)
    }
    setBusy(false)
  }

  const testConnection = async () => {
    setBusy(true)
    setStatus('')
    save()
    try {
      const reply = await aiSend({
        system: '', messages: [chatMessage('user', '请只回复“连接成功”这四个字。')], maxTokens: 2000, config: currentConfig(),
      })
      setStatus(`连接成功，模型回复：${Array.from(reply).slice(0, 40).join('')}`)
      setStatusOK(true)
    } catch (e) {
      setStatus(aiErrorText(e))
      setStatusOK(false)
    }
    setBusy(false)
  }

  // 网页版用 app 自己的样子（和设置页一样的分块、粗描边），不模仿 iPad 上的系统表单
  return (
    <div style={compact
      // 手机上留白小一些，弹键盘时整页让开
      ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '12px 16px 0', gap: 12, color: 'var(--ink)', ...keyboardMargins(keyboard) }
      : { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '28px 28px 0', gap: 18, color: 'var(--ink)' }}>
      <STPageHeader title="AI 设置" onClose={() => { save(); onClose() }} />
      <div className="scroll-hidden" style={compact
        ? { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 22, paddingBottom: 24 }
        : { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 30 }}>
        <STSection title="提供商">
          <STRow title="用哪家的 AI" hint={provider.note}>
            <Select
              value={providerID}
              options={aiProviders.map((p) => [p.id, p.name])}
              onChange={(v) => {
                save()
                AISettings.providerID = v
                load()
              }}
            />
          </STRow>
        </STSection>

        <STSection title="API Key">
          <STRow title="粘贴你自己的 Key" hint="Key 只保存在这个浏览器里，请求直接从这台设备发给你选的提供商。">
            <input
              style={field}
              type="password"
              placeholder="粘贴 API Key"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </STRow>
        </STSection>

        <STSection title="模型">
          {modelChoices.length > 0 ? (
            <STRow title="选择模型">
              <Select value={model} options={modelChoices.map((m) => [m, m])} onChange={setModel} />
            </STRow>
          ) : null}
          <STRow title="或者直接填模型 ID" hint="图片生成剧本需要支持图片输入的模型。">
            <input
              style={field}
              placeholder="模型 ID"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <div>
              <STChoice selected={false} disabled={busy || apiKey === ''} onClick={fetchModels}>
                <span style={rounded(17, 700)}>获取模型列表</span>
              </STChoice>
            </div>
          </STRow>
        </STSection>

        <STSection title="接口地址">
          <STRow title="一般不用改" hint="用代理或者自己部署的服务时才需要填。">
            <input
              style={field}
              type="url"
              inputMode="url"
              placeholder="https://..."
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
            />
            {baseURL !== provider.defaultBaseURL && provider.defaultBaseURL !== '' ? (
              <div>
                <STChoice selected={false} onClick={() => setBaseURL(provider.defaultBaseURL)}>
                  <span style={rounded(17, 700)}>恢复默认地址</span>
                </STChoice>
              </div>
            ) : null}
          </STRow>
        </STSection>

        <STSection title="测试">
          <STRow title="发一句话试试能不能连上">
            <div>
              <STChoice selected disabled={busy || apiKey === '' || model === ''} onClick={testConnection}>
                <span style={rounded(17, 700)}>{busy ? '请稍候…' : '测试连接'}</span>
              </STChoice>
            </div>
            {status !== '' ? (
              <div className="ai-select-text" style={{ ...rounded(16, 600), lineHeight: 1.4, color: statusOK ? '#2e7d32' : 'var(--warningRed)' }}>{status}</div>
            ) : null}
          </STRow>
        </STSection>
      </div>
    </div>
  )
}

const field: React.CSSProperties = {
  ...rounded(17, 600), width: '100%', padding: '9.5px 13.5px', borderRadius: 12,
  border: '2.5px solid var(--ink)', outline: 'none', background: 'var(--mainbg)', color: 'var(--ink)',
}

/** 下拉选择：和输入框一样的粗描边框，右边上下箭头，点开是系统的选择列表 */
function Select({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  const label = options.find(([v]) => v === value)?.[1] ?? value
  return (
    <div style={{ ...field, position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <SFIcon name="chevron.up.chevron.down" size={16} weight="bold" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', fontSize: 16 }}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

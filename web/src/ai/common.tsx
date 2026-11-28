// AI 面板共用的小组件和请求，对应 AISettingsView.swift 下半部分（AIPanelHeader、AIPillLabel、AIChip、AIProgressLine）
// 以及 AISetupViews.swift 里的 aiRequestJSON
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './ai.css'
import { rounded } from '../ui/kit'
import { SFIcon } from '../ui/SFIcon'
import { useCompact } from '../ui/compact'
import { CloseButton } from '../mobile/MobilePage'
import { AISettings, aiSaveFailedReply, useAISettings } from './providers'
import { AIError, aiExtractJSON, aiSendStreaming, chatMessage, type AIChatMessage } from './client'
import { AISettingsView } from './AISettingsView'

/** AI 思考阶段的进度文字。模型的思考摘要多是英文夹着角色名，截出来是半句半句的，对说书人没用，只显示在思考 */
export function aiThinkingTail(_thinking: string): string {
  return '正在思考…'
}

/** 请求一个 JSON 对象；回复解析失败时自动再要一次，并把出错的原文存下来方便排查 */
export async function aiRequestJSON(system: string, user: string, writingLabel: string, progress: (text: string) => void): Promise<Record<string, unknown>> {
  let messages: AIChatMessage[] = [chatMessage('user', user)]
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await aiSendStreaming({
      system,
      messages,
      maxTokens: 16000,
      effort: 'high',
      onThinking: (thought) => progress(aiThinkingTail(thought)),
      onProgress: (partial) => {
        if (partial !== '') progress(attempt === 0 ? writingLabel : '格式有误，正在重写…')
      },
    })
    const object = aiExtractJSON(reply)
    if (isObject(object)) return object
    aiSaveFailedReply(reply)
    // 第二次：把上一次的回复交回去，让它只重写成合法 JSON
    messages = [
      chatMessage('user', user),
      chatMessage('assistant', reply),
      chatMessage('user', '你上面的回复不是合法的 JSON，程序无法读取。请把同样的内容重新输出成一个合法的 JSON 对象：只输出 JSON 本身，不要任何说明文字和代码块标记，字符串里不要出现英文双引号。'),
    ]
    progress('格式有误，正在重写…')
  }
  throw new AIError('badFormat', '模型连续两次没有返回合法的 JSON，请点重新生成')
}

export const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

/** 取字符串数组里的字符串（对应 Swift 的 compactMap { $0 as? String }） */
export const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
export const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** AI 面板的外框：.padding(20) + mainbg 底色 */
export const aiPanelStyle = (spacing: number, padding: number | string = 20): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', gap: spacing, padding, flex: 1, minHeight: 0,
  background: 'var(--mainbg)', color: 'var(--ink)',
})

/** 手机上 AI 面板的留白（底下的安全区 Sheet 已经留了） */
export const aiCompactPadding = '10px 16px 12px'

/**
 * 手机上屏幕键盘挡住的高度（bottom），以及系统为了露出输入框把页面往上推的距离（top）。
 * iOS 和安卓 Chrome 弹键盘时只缩小 visualViewport，fixed 的面板不会变矮，要自己让开
 */
export function useKeyboardInset(enabled: boolean): { top: number; bottom: number } {
  const [inset, setInset] = useState({ top: 0, bottom: 0 })
  useEffect(() => {
    const vv = window.visualViewport
    if (!enabled || !vv) return
    const update = () => {
      const layoutHeight = document.documentElement.clientHeight
      const top = Math.max(0, Math.round(vv.offsetTop))
      let bottom = Math.max(0, Math.round(layoutHeight - vv.height - vv.offsetTop))
      if (bottom < 2) bottom = 0
      setInset((o) => (o.top === top && o.bottom === bottom ? o : { top, bottom }))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])
  return enabled ? inset : { top: 0, bottom: 0 }
}

/** 按键盘让开的外边距：顶上补回被推走的部分，底下让出键盘（键盘盖住了底部横条，Sheet 留的安全区要扣回来） */
export const keyboardMargins = (inset: { top: number; bottom: number }): React.CSSProperties => ({
  marginTop: inset.top,
  marginBottom: inset.bottom > 0 ? `calc(${inset.bottom}px - env(safe-area-inset-bottom))` : 0,
})

/** 各个 AI 面板共用的顶栏。齿轮打开 AI 设置 */
export function AIPanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  useAISettings((s) => s.version + s.providerID)
  const [showSettings, setShowSettings] = useState(false)
  const configured = AISettings.isConfigured
  const p = AISettings.provider
  const compact = useCompact()
  if (compact) {
    // 手机上：标题下面一行小字写模型，右边齿轮和圆形关闭按钮
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ ...rounded(22, 900), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{title}</div>
          <div style={{
            ...rounded(13), color: configured ? 'var(--ai-secondary)' : 'var(--ai-red)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {configured ? `${p.name} · ${AISettings.model(p)}` : '未配置 AI'}
          </div>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          aria-label="AI 设置"
          style={{
            width: 38, height: 38, borderRadius: '50%', border: '2.5px solid var(--ink)', color: 'var(--ink)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <SFIcon name="gearshape" size={20} weight="bold" />
        </button>
        <CloseButton onClick={onClose} />
        <AISettingsView open={showSettings} onClose={() => setShowSettings(false)} />
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ ...rounded(24, 900), whiteSpace: 'nowrap' }}>{title}</div>
      <div style={{ flex: 1 }} />
      <div style={{
        ...rounded(14), color: configured ? 'var(--ai-secondary)' : 'var(--ai-red)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
      }}>
        {configured ? `${p.name} · ${AISettings.model(p)}` : '未配置 AI'}
      </div>
      <button onClick={() => setShowSettings(true)} style={{ marginLeft: 10, color: 'var(--ink)' }} aria-label="AI 设置">
        <SFIcon name="gearshape" size={24} weight="bold" />
      </button>
      <button onClick={onClose} style={{ marginLeft: 10, color: 'var(--ink)' }} aria-label="关闭">
        <SFIcon name="xmark.circle" size={24} weight="bold" />
      </button>
      <AISettingsView open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}

export function AIPillLabel({ text, filled = false }: { text: string; filled?: boolean }) {
  const compact = useCompact()
  return (
    <span style={{
      ...rounded(compact ? 16 : 18, 700), display: 'inline-block', whiteSpace: 'nowrap',
      color: filled ? 'var(--paper)' : 'var(--ink)', background: filled ? 'var(--ink)' : 'var(--paper)',
      padding: compact ? '7px 14px' : '8.5px 16.5px', borderRadius: 24, border: '3px solid var(--ink)', // iPad 的描边不占位置，减掉 1.5
    }}>{text}</span>
  )
}

/** Button { AIPillLabel } */
export function AIPillButton({ text, filled, onClick, disabled }: { text: string; filled?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="ai-btn" onClick={onClick} disabled={disabled} style={{ flexShrink: 0 }}>
      <AIPillLabel text={text} filled={filled} />
    </button>
  )
}

export function AIChip({ text, onClick, style }: { text: string; onClick: () => void; style?: React.CSSProperties }) {
  const compact = useCompact()
  return (
    <button onClick={onClick} style={{
      ...rounded(15, 600), color: 'var(--ink)', background: 'var(--paper)',
      padding: '5px 11px', borderRadius: 16, border: '2px solid var(--ink)', textAlign: 'left', // 描边不占位置，减掉 1
      ...(compact ? { minHeight: 36, padding: '6px 12px', borderRadius: 18 } : null),
      ...style,
    }}>{text}</button>
  )
}

/** 一排自动换行的小按钮，对应 HFlow */
export function AIFlow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', width: '100%' }}>{children}</div>
}

/** iOS 的 ProgressView（转圈） */
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="ai-spinner" width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={i} x1="10" y1="2.2" x2="10" y2="6.2"
          stroke="var(--ai-spinner)" strokeWidth="2.2" strokeLinecap="round"
          opacity={0.25 + (0.75 * i) / 7}
          transform={`rotate(${i * 45} 10 10)`}
        />
      ))}
    </svg>
  )
}

/** 各个 AI 面板共用的进度行：转圈、当前在做什么、已经用了多少秒 */
export function AIProgressLine({ since, text }: { since: number; text: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const seconds = Math.max(0, Math.floor((now - since) / 1000))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <Spinner />
      <span style={{ ...rounded(15, 600), color: 'var(--ai-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {`${text}（${seconds} 秒）`}
      </span>
    </div>
  )
}

/** TextField(axis: .vertical).lineLimit(1...n)，外面一圈 paper 底的描边框 */
export function AITextField({ value, onChange, placeholder, maxLines, fontSize = 17, onSubmit, style }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  maxLines: number
  fontSize?: number
  onSubmit?: () => void
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const lineHeight = Math.round(fontSize * 1.3)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * maxLines)}px`
  }, [value, lineHeight, maxLines])
  return (
    <div style={{
      padding: 9, background: 'var(--paper)', borderRadius: 12, border: '2px solid var(--ink)', // 10 - 1
      flex: 1, minWidth: 0, ...style,
    }}>
      <textarea
        ref={ref}
        className="ai-field"
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (onSubmit && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault()
            onSubmit()
          }
        }}
        style={{ ...rounded(fontSize), lineHeight: `${lineHeight}px`, color: 'var(--ink)', overflowY: 'auto' }}
      />
    </div>
  )
}

/** iOS 的 Toggle：左边是说明，右边是开关，.tint(.ink) */
export function AIToggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  const compact = useCompact()
  if (compact) {
    // 手机上开关外面套一圈透明的点击区域，高 38
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        <button
          role="switch"
          aria-checked={on}
          onClick={() => onChange(!on)}
          style={{ width: 55, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span style={{
            width: 51, height: 31, borderRadius: 16, position: 'relative', display: 'block',
            background: on ? 'var(--ink)' : 'var(--ai-switch-off)', transition: 'background .2s',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: '50%',
              background: '#fff', boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.16)', transition: 'left .2s',
            }} />
          </span>
        </button>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        style={{
          width: 51, height: 31, borderRadius: 16, flexShrink: 0, position: 'relative',
          background: on ? 'var(--ink)' : 'var(--ai-switch-off)', transition: 'background .2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: '50%',
          background: '#fff', boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.16)', transition: 'left .2s',
        }} />
      </button>
    </div>
  )
}

/** 模型偶尔会用 **加粗** 这类 Markdown，只认行内的写法（加粗、斜体、删除线、代码、链接），换行原样保留 */
export function AIMarkdown({ text }: { text: string }) {
  return <>{parseInline(text, 0)}</>
}

function parseInline(text: string, depth: number): React.ReactNode[] {
  const out: React.ReactNode[] = []
  if (depth > 4) return [text]
  // 依次匹配：代码、链接、加粗、删除线、斜体
  const re = /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*|__(?=\S)([\s\S]+?)(?<=\S)__(?![\p{L}\p{N}])|~~(?=\S)([\s\S]+?)(?<=\S)~~|\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*/gu
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${depth}-${k++}`
    if (m[1] !== undefined) {
      out.push(<code key={key} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92em' }}>{m[1]}</code>)
    } else if (m[2] !== undefined) {
      out.push(<a key={key} href={m[3]} target="_blank" rel="noreferrer" style={{ color: 'var(--ai-blue)' }}>{parseInline(m[2], depth + 1)}</a>)
    } else if (m[4] !== undefined || m[5] !== undefined) {
      out.push(<strong key={key} style={{ fontWeight: 700 }}>{parseInline(m[4] ?? m[5], depth + 1)}</strong>)
    } else if (m[6] !== undefined) {
      out.push(<s key={key}>{parseInline(m[6], depth + 1)}</s>)
    } else if (m[7] !== undefined) {
      out.push(<em key={key}>{parseInline(m[7], depth + 1)}</em>)
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** 下载一个文件 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

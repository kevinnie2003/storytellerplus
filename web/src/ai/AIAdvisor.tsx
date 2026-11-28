// AI 说书：游戏中给说书人的建议。对应 iPad 版 AI/AIAdvisorView.swift
// 对话记录在 iPad 版是 StoryTellerView 的 @State，关掉面板还在、离开小镇就没了；这里放在模块级的 store 里，按 gameID 区分，TownScreen 卸载时调 resetAIChat() 清掉
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { useGame } from '../game/store'
import { Sheet } from '../ui/Sheet'
import { rounded } from '../ui/kit'
import { useCompact } from '../ui/compact'
import { aiErrorText, aiSendStreaming, chatMessage, type AIChatMessage } from './client'
import { makeAIContext } from './context'
import { advisorSystem, savantBatchPrompt, withHouseRules } from './prompts'
import {
  AIChip, AIFlow, AIMarkdown, AIPanelHeader, AIPillButton, AIProgressLine, AITextField, aiCompactPadding, aiPanelStyle, aiThinkingTail,
  keyboardMargins, useKeyboardInset,
} from './common'

interface AIChatStore {
  gameID: string
  chat: AIChatMessage[]
}

const useAIChat = create<AIChatStore>(() => ({ gameID: '', chat: [] }))

/** 当前这一局的对话 */
function useChat(): [AIChatMessage[], (update: (chat: AIChatMessage[]) => AIChatMessage[]) => void] {
  const gameID = useGame((s) => s.gameID)
  const stored = useAIChat()
  const chat = stored.gameID === gameID ? stored.chat : []
  const setChat = (update: (chat: AIChatMessage[]) => AIChatMessage[]) => updateChat(gameID, update)
  return [chat, setChat]
}

function updateChat(gameID: string, update: (chat: AIChatMessage[]) => AIChatMessage[]) {
  const s = useAIChat.getState()
  const current = s.gameID === gameID ? s.chat : []
  useAIChat.setState({ gameID, chat: update(current) })
}

/** 清掉对话记录（换局时可以调用） */
export function resetAIChat() {
  useAIChat.setState({ gameID: '', chat: [] })
}

const quickPrompts = [
  '现在局势偏向哪边？我该怎么平衡？',
  '今晚的信息怎么给比较好？',
  '有人醉酒或中毒，给什么假信息合适？',
  '这局有哪些内容要我自己编？帮我定好',
  '博学者来问信息，给哪两条？',
  '今晚恶魔的刀怎么处理比较有戏？',
]

export function AIAdvisor({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      {open ? <AdvisorBody onClose={onClose} /> : null}
    </Sheet>
  )
}

const bubble = (user: boolean): React.CSSProperties => ({
  ...rounded(17, 500),
  color: user ? 'var(--paper)' : 'var(--ink)',
  background: user ? 'var(--ink)' : 'var(--paper)',
  padding: 11, borderRadius: 14, border: '2px solid var(--ink)', // 12 - 描边一半在框里
  whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: 0,
})

const chipNoWrap: React.CSSProperties = { whiteSpace: 'nowrap', flexShrink: 0 }

function AdvisorBody({ onClose }: { onClose: () => void }) {
  const [chat, setChat] = useChat()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [progress, setProgress] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [errorText, setErrorText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const compact = useCompact()
  const keyboard = useKeyboardInset(compact)

  const send = async (text: string, display?: string, effort?: string) => {
    const question = text.trim()
    if (question === '' || busyRef.current) return
    const gameID = useGame.getState().gameID
    const userMessage = chatMessage('user', question, display)
    let history: AIChatMessage[] = []
    updateChat(gameID, (c) => (history = [...c, userMessage]))
    setInput('')
    setErrorText('')
    busyRef.current = true
    setBusy(true)
    setStartedAt(Date.now())
    setProgress('正在思考…')
    setStreamingText('')
    const system = withHouseRules(advisorSystem(makeAIContext()))
    try {
      const reply = await aiSendStreaming({
        system, messages: history, maxTokens: 32000, effort: effort ?? null,
        onThinking: (thought) => setProgress(aiThinkingTail(thought)),
        onProgress: (partial) => setStreamingText(partial),
      })
      setStreamingText('')
      updateChat(gameID, (c) => [...c, chatMessage('assistant', reply.trim())])
    } catch (e) {
      setErrorText(aiErrorText(e))
    }
    busyRef.current = false
    setBusy(false)
    setStreamingText('')
  }

  // 流式输出和新消息时滚到底部
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [streamingText, busy])
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [chat.length])
  // 手机上键盘弹出、收起后，对话区变矮了，也滚到底部
  useEffect(() => {
    const el = scrollRef.current
    if (el && compact) el.scrollTo({ top: el.scrollHeight })
  }, [compact, keyboard.bottom])

  const chips = (
    <>
      <AIChip text="一批博学者信息，我来挑" onClick={() => send(savantBatchPrompt(), '一批博学者信息，我来挑', 'medium')} style={compact ? chipNoWrap : undefined} />
      {quickPrompts.map((p) => <AIChip key={p} text={p} onClick={() => send(p)} style={compact ? chipNoWrap : undefined} />)}
      {chat.length > 0 ? (
        <AIChip text="清空对话" onClick={() => { setChat(() => []); setErrorText('') }} style={compact ? chipNoWrap : undefined} />
      ) : null}
    </>
  )

  if (compact) {
    // 手机上：快捷问题排成一行左右滑，输入栏贴着键盘
    return (
      <div style={{ ...aiPanelStyle(10, aiCompactPadding), ...keyboardMargins(keyboard) }}>
        <AIPanelHeader title="AI 说书" onClose={onClose} />
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
            {chat.length === 0 ? (
              <div style={{ ...rounded(15), color: 'var(--ai-secondary)' }}>AI 能看到当前魔典、标记和游戏记录。问它怎么给信息、怎么平衡局势都可以。</div>
            ) : null}
            {chat.map((m) => {
              const user = m.role === 'user'
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: user ? 'flex-end' : 'flex-start', paddingLeft: user ? 36 : 0, paddingRight: user ? 0 : 20 }}>
                  <div className="ai-select-text" style={{ ...bubble(user), ...rounded(16, 500), padding: 9 }}><AIMarkdown text={m.display ?? m.text} /></div>
                </div>
              )
            })}
            {busy ? (
              streamingText === '' ? (
                <AIProgressLine since={startedAt} text={progress} />
              ) : (
                <div style={{ display: 'flex', paddingRight: 20 }}>
                  <div style={{ ...bubble(false), ...rounded(16, 500), padding: 9 }}><AIMarkdown text={streamingText} /></div>
                </div>
              )
            ) : null}
            {errorText !== '' ? <div className="ai-select-text" style={{ ...rounded(15), color: 'var(--ai-red)' }}>{errorText}</div> : null}
          </div>
        </div>
        <div className="scroll-hidden" style={{ overflowX: 'auto', margin: '0 -16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, padding: '0 16px', width: 'max-content' }}>{chips}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <AITextField value={input} onChange={setInput} placeholder="问点什么…" maxLines={4} onSubmit={() => send(input)} />
          <AIPillButton text="发送" filled onClick={() => send(input)} disabled={busy} />
        </div>
      </div>
    )
  }

  return (
    <div style={aiPanelStyle(12)}>
      <AIPanelHeader title="AI 说书" onClose={onClose} />
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '5px 0' }}>
          {chat.length === 0 ? (
            <div style={{ ...rounded(16), color: 'var(--ai-secondary)' }}>AI 能看到当前魔典、标记和游戏记录。问它怎么给信息、怎么平衡局势都可以。</div>
          ) : null}
          {chat.map((m) => {
            const user = m.role === 'user'
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: user ? 'flex-end' : 'flex-start', paddingLeft: user ? 68 : 0, paddingRight: user ? 0 : 68 }}>
                <div className="ai-select-text" style={bubble(user)}><AIMarkdown text={m.display ?? m.text} /></div>
              </div>
            )
          })}
          {busy ? (
            streamingText === '' ? (
              <AIProgressLine since={startedAt} text={progress} />
            ) : (
              <div style={{ display: 'flex', paddingRight: 68 }}>
                <div style={bubble(false)}><AIMarkdown text={streamingText} /></div>
              </div>
            )
          ) : null}
          {errorText !== '' ? <div className="ai-select-text" style={{ ...rounded(15), color: 'var(--ai-red)' }}>{errorText}</div> : null}
        </div>
      </div>
      <AIFlow>{chips}</AIFlow>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AITextField
          value={input}
          onChange={setInput}
          placeholder="问点什么，比如：3号博学者来问信息怎么给"
          maxLines={3}
          onSubmit={() => send(input)}
        />
        <AIPillButton text="发送" filled onClick={() => send(input)} disabled={busy} />
      </div>
    </div>
  )
}

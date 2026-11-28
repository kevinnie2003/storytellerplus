// 整局记录，对应 SubViews/conversation/ConversationView.swift；存长图对应 SaveConversation.swift 的 exportGameLog
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Character, GameLogEntry } from '../game/types'
import { game, setGame, useGame } from '../game/store'
import { makeLog } from '../game/log'
import { team2Int } from '../game/loadScript'
import { showAlert } from '../ui/Alert'
import { SFIcon } from '../ui/SFIcon'
import { rounded } from '../ui/kit'
import { useCompact } from '../ui/compact'
import { HeaderButton, MobilePage } from '../mobile/MobilePage'
import { ConversationLogView } from './ConversationLog'
import { MenuPicker, OverlayLayer, panelHeight, stroke, systemGreen } from './common'
import { renderToPng, saveImages, timestampName } from './exportImage'

export function Conversation() {
  const show = useGame((s) => s.showConversation)
  return show ? <ConversationView /> : null
}

/** 每 40 条画一张图，宽 width */
export async function exportGameLog(width: number, playersAssignedCharacters: Character[], allLogs: GameLogEntry[]) {
  const images: { name: string; dataUrl: string }[] = []
  const stamp = timestampName('整局记录').replace(/\.png$/, '')
  for (let start = 0; start < allLogs.length; start += 40) {
    const end = Math.min(start + 40, allLogs.length) - 1
    const dataUrl = await renderToPng(
      <div style={{ width, background: 'var(--mainbg)', color: 'var(--ink)', padding: '20px 0' }}>
        <ConversationLogView allLogs={allLogs} playerCount={playersAssignedCharacters.length} start={start} end={end} fixed />
      </div>,
      width,
    )
    images.push({ name: allLogs.length > 40 ? `${stamp}-${start / 40 + 1}.png` : `${stamp}.png`, dataUrl })
  }
  if (images.length === 0) return 'empty' as const
  return saveImages(images)
}

function ConversationView() {
  const players = useGame((s) => s.playersAssignedCharacters)
  const allLogs = useGame((s) => s.allLogs)
  const compact = useCompact()
  // 默认是最后一项“说书人”
  const [currentSelection, setCurrentSelection] = useState(() => game().playersAssignedCharacters.length)
  const [inputText, setInputText] = useState('')
  const [exportedMessage, setExportedMessage] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  const scrollToBottom = (smooth: boolean) => {
    const el = scroller.current
    // iPad 是 scrollTo(最后一条, anchor: .bottom)：最后一条贴着底边，下面那 20 的留白不露出来
    if (el) el.scrollTo({ top: Math.max(0, el.scrollHeight - el.clientHeight - 20), behavior: smooth ? 'smooth' : 'auto' })
  }
  // 换成手机或大屏布局时也滚到底
  useLayoutEffect(() => { scrollToBottom(false) }, [compact])
  useEffect(() => { scrollToBottom(true) }, [allLogs.length])

  useEffect(() => {
    if (!exportedMessage) return
    const t = window.setTimeout(() => setExportedMessage(''), 3000)
    return () => window.clearTimeout(t)
  }, [exportedMessage])

  const askExport = () => showAlert({
    title: '把整局记录存成长图吗？',
    message: '会把从开局到现在的全部记录画成一张长图，存进相册。',
    buttons: [
      { label: '取消', role: 'cancel' },
      {
        label: '保存',
        action: () => {
          const s = game()
          exportGameLog(1000, s.playersAssignedCharacters, s.allLogs)
            .then((r) => {
              if (r === 'shared') setExportedMessage('已存进相册')
              else if (r === 'downloaded') setExportedMessage('已下载')
            })
            .catch(() => setExportedMessage(''))
        },
      },
    ],
  })

  const send = () => {
    if (inputText === '') return
    const isPlayer = currentSelection < players.length
    const name = isPlayer ? players[currentSelection].name : '说书人'
    setGame((s) => ({
      allLogs: [...s.allLogs, makeLog({
        message: inputText, messager: isPlayer ? currentSelection + 1 : 21, source: '', type: 3, characterName: name,
        playerCharacters: [name], playerTeams: [isPlayer ? team2Int(players[currentSelection].team) : 5],
      })],
    }))
    setInputText('')
  }

  const options = [
    ...players.map((p, i) => ({ value: i, label: `${i + 1}号 ${p.name}` })),
    { value: players.length, label: '说书人' },
  ]

  if (compact) {
    return (
      <MobilePage
        title="整局记录"
        zIndex={114}
        scroll={false}
        onClose={() => setGame({ showConversation: false })}
        right={<span data-tour="log.export" style={{ display: 'flex' }}><HeaderButton icon="square.and.arrow.down" label="长图" onClick={askExport} /></span>}
      >
        <div data-tour="log.panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {exportedMessage ? (
            <div style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1, whiteSpace: 'nowrap',
              ...rounded(15, 700), color: systemGreen, background: 'var(--mainbg)', padding: '6px 14px', borderRadius: 16,
              outline: `2.5px solid ${systemGreen}`, outlineOffset: -1.25, animation: 'st-fade .2s ease-out',
            }}>{exportedMessage}</div>
          ) : null}
          <div ref={scroller} className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={{ padding: '12px 10px 20px' }}>
              <ConversationLogView allLogs={allLogs} playerCount={players.length} compact />
            </div>
          </div>
          {/* 底栏：谁说的、说了什么、发送 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderTop: '3px solid var(--ink)', flexShrink: 0 }}>
            <div style={{ flexShrink: 0, maxWidth: '38%', height: 44, display: 'flex', alignItems: 'center', padding: '0 4px', ...stroke(2.5, 12) }}>
              <MenuPicker options={options} value={currentSelection} onChange={setCurrentSelection} tint="var(--ink)" style={{ width: '100%' }} />
            </div>
            <input
              value={inputText}
              placeholder="输入聊天内容"
              enterKeyHint="send"
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }}
              style={{
                ...rounded(16, 600), color: 'var(--ink)', flex: 1, minWidth: 0, height: 44, padding: '0 12px',
                background: 'transparent', border: 'none', ...stroke(2.5, 12),
              }}
            />
            <button
              aria-label="发送"
              onClick={send}
              disabled={inputText === ''}
              style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--ink)', color: 'var(--mainbg)', opacity: inputText === '' ? 0.35 : 1,
              }}
            >
              <SFIcon name="paperplane.fill" size={20} />
            </button>
          </div>
        </div>
      </MobilePage>
    )
  }

  return (
    <OverlayLayer zIndex={14} background="var(--mainbg)" onDoubleTapBackground={() => setGame({ showConversation: false })}>
      <div
        data-tour="log.panel"
        style={{
          position: 'relative', width: 800, height: panelHeight, display: 'flex', flexDirection: 'column', gap: 8,
          overflow: 'hidden', ...stroke(3, 20),
        }}
      >
        {/* 顶栏：整局记录存成长图 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 0' }}>
          <div style={rounded(22, 900)}>整局记录</div>
          <div style={{ flex: 1 }} />
          {exportedMessage ? <div style={{ ...rounded(16, 600), color: systemGreen }}>{exportedMessage}</div> : null}
          <button
            data-tour="log.export"
            onClick={askExport}
            style={{
              ...rounded(18, 700), color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', ...stroke(2, 10),
            }}
          >
            <SFIcon name="square.and.arrow.down" size={19} weight="bold" />
            <span>存成长图</span>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, padding: '20px 10px' }}>
          <div ref={scroller} style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={{ padding: '20px 0' }}>
              <ConversationLogView allLogs={allLogs} playerCount={players.length} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 5px' }}>
          <div style={{ width: 150, flexShrink: 0, padding: '5px 5px', ...stroke(2, 10) }}>
            <MenuPicker options={options} value={currentSelection} onChange={setCurrentSelection} tint="var(--ink)" />
          </div>
          <input
            value={inputText}
            placeholder="输入聊天内容"
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            style={{
              ...rounded(20, 600), color: 'var(--ink)', width: 520, flexShrink: 0, padding: 10,
              background: 'transparent', border: 'none', ...stroke(2, 10),
            }}
          />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', padding: '0 5px', ...stroke(2, 5) }}>
            <button onClick={send} style={{ ...rounded(20, 600), color: 'var(--ink)', padding: 10 }}>发送</button>
          </div>
        </div>
      </div>
    </OverlayLayer>
  )
}

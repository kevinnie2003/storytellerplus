// 开始页，对应 iPad 版 ContentView 里 viewNumber == 0 的部分和 StartChooser
import { useEffect, useRef, useState } from 'react'
import { useNav } from '../nav'
import { rounded, STBigButton } from '../ui/kit'
import { SFIcon } from '../ui/SFIcon'
import { useCompact } from '../ui/compact'
import { SettingsView } from '../settings/SettingsView'
import { ArchiveView } from '../settings/ArchiveView'
import { AIScriptImport } from '../ai/AIScriptImport'
import { startTutorial } from '../tutorial'
import { archiveLoad, loadLastGame, saveLastGame } from '../game/persistence'
import { setupPWA } from '../pwa'

setupPWA()

/** 上一局（“继续上一局”用）的剧本名，没有就是空 */
function lastGameName(): string {
  const game = loadLastGame()
  if (!game) return ''
  return game.playName ? game.playName : '无名剧本'
}

/**
 * 读剧本 JSON：最外层要是数组，里面不是对象的条目（比如官方剧本格式里只写角色 id 的字符串）直接跳过，
 * 只要还剩下对象就能开局。对应 iPad 版 readJSON
 */
export function parseScriptJSON(text: string): Record<string, unknown>[] | null {
  let root: unknown
  try {
    // JSONSerialization 认得开头的 BOM，JSON.parse 不认
    root = JSON.parse(text.replace(/^﻿/, ''))
  } catch (error) {
    console.log(`Failed to read JSON: ${(error as Error).message}`)
    return null
  }
  if (!Array.isArray(root)) {
    console.log('Expected a top-level array.')
    return null
  }
  const dictionaries = root.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x))
  if (dictionaries.length === 0) {
    console.log('No dictionary objects found in array.')
    return null
  }
  console.log(`Loaded ${dictionaries.length} dictionary items (ignored ${root.length - dictionaries.length} non-dictionary items)`)
  return dictionaries
}

/** 出现、消失都带一点动画（SwiftUI 的 transition） */
function usePresence(show: boolean, ms: number) {
  const [mounted, setMounted] = useState(show)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (show) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(t)
  }, [show, ms])
  return { mounted, visible }
}

const safeTop = 'max(24px, env(safe-area-inset-top))'
const safeBottom = 'max(20px, env(safe-area-inset-bottom))'

export function StartScreen() {
  const [showStartChooser, setShowStartChooser] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAIImport, setShowAIImport] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const chooser = usePresence(showStartChooser, 200)
  const compact = useCompact()

  const enterNewGame = (items: Record<string, unknown>[]) => {
    useNav.setState({ playJSON: items, loadLast: false, viewNumber: 1 })
  }

  const openArchive = async (id: string) => {
    const data = await archiveLoad(id)
    if (data) {
      saveLastGame(data)
      useNav.setState({ loadLast: true, viewNumber: 1 })
    }
  }

  const readJSON = async (file: File) => {
    try {
      const items = parseScriptJSON(await file.text())
      if (items) enterNewGame(items)
    } catch (error) {
      console.log(`Failed to import file: ${(error as Error).message}`)
    }
  }

  const name = showStartChooser || chooser.mounted ? lastGameName() : ''

  return (
    <div className="dot-bg" style={{ position: 'fixed', inset: 0, color: 'var(--ink)', overflow: 'hidden' }}>
      {/* 底部：新手教程和测试版说明 */}
      <div style={{
        position: 'absolute', inset: 0, paddingTop: safeTop, paddingBottom: safeBottom,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
        pointerEvents: 'none',
      }}>
        <button
          onClick={() => startTutorial()}
          style={{
            ...rounded(18, 700), pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)',
            padding: '7.5px 17.5px' /* 10/20 - 描边 2.5 */, background: 'var(--paper)', borderRadius: 999, border: '2.5px solid var(--ink)',
          }}
        >
          <FilledQuestionCircle size={20} />
          <span>新手教程</span>
        </button>
        {/* 玩家走错了地方：带他去说书人联机 */}
        <a
          href={`${import.meta.env.BASE_URL}online/`}
          style={{ ...rounded(15, 700), pointerEvents: 'auto', color: 'var(--ink)', opacity: 0.75, textDecoration: 'underline', textUnderlineOffset: 3 }}
        >我是玩家：打开说书人联机，输入房间号</a>
        <div style={compact
          // 手机上一行放不下，字小一点、居中换行
          ? { fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif', fontSize: 13, lineHeight: '18px', textAlign: 'center', padding: '0 24px', opacity: 0.8 }
          : { fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif', fontSize: 17, lineHeight: '22px' }}>
          本产品仍为测试版，遇到任何bug或有需求请大胆联系作者
        </div>
      </div>

      {/* 中间：标题和两个大按钮 */}
      <div style={{
        position: 'absolute', inset: 0, paddingTop: safeTop, paddingBottom: safeBottom,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
        pointerEvents: 'none',
      }}>
        <div style={{ ...rounded(compact ? 40 : 52, 900), marginBottom: compact ? 14 : 26 }}>说书人普拉斯</div>
        <STBigButton title="开始游戏" systemImage="play.fill" filled onClick={() => setShowStartChooser(true)} style={{ width: compact ? 'min(320px, calc(100vw - 48px))' : 320, pointerEvents: 'auto' }} />
        <STBigButton title="设置" systemImage="gearshape.fill" onClick={() => setShowSettings(true)} style={{ width: compact ? 'min(320px, calc(100vw - 48px))' : 320, pointerEvents: 'auto' }} />
      </div>

      {chooser.mounted ? (
        <>
          <div
            onClick={() => setShowStartChooser(false)}
            style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)',
              opacity: chooser.visible ? 1 : 0, transition: 'opacity .2s ease-out',
            }}
          />
          <div style={{
            position: 'absolute', inset: 0, paddingTop: safeTop, paddingBottom: safeBottom,
            display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              ...(compact ? { maxHeight: '100%', display: 'flex' } : null),
              pointerEvents: chooser.visible ? 'auto' : 'none',
              opacity: chooser.visible ? 1 : 0, transform: chooser.visible ? 'none' : 'scale(0.95)',
              transition: 'opacity .2s ease-out, transform .2s ease-out',
            }}>
              <StartChooser
                lastGameName={name}
                onUploadJSON={() => {
                  setShowStartChooser(false)
                  useNav.setState({ loadLast: false })
                  if (fileInput.current) {
                    fileInput.current.value = ''
                    fileInput.current.click()
                  }
                }}
                onImageScript={() => { setShowStartChooser(false); setShowAIImport(true) }}
                onContinue={() => {
                  setShowStartChooser(false)
                  useNav.setState({ loadLast: true, viewNumber: 1 })
                }}
                onOpenArchive={() => { setShowStartChooser(false); setShowArchive(true) }}
                onClose={() => setShowStartChooser(false)}
              />
            </div>
          </div>
        </>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void readJSON(file)
        }}
      />

      <SettingsView open={showSettings} onClose={() => setShowSettings(false)} />
      <AIScriptImport open={showAIImport} onClose={() => setShowAIImport(false)} onEnter={enterNewGame} />
      <ArchiveView open={showArchive} onClose={() => setShowArchive(false)} onLoad={(id) => { void openArchive(id) }} />
    </div>
  )
}

/** SF 的 questionmark.circle.fill：实心圆，问号是镂空的 */
function FilledQuestionCircle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" fill="none" stroke="var(--paper)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="17.2" r="1.5" fill="var(--paper)" />
    </svg>
  )
}

/** 点“开始游戏”后的选择：开一局新的，或者回到存档 */
function StartChooser({ lastGameName, onUploadJSON, onImageScript, onContinue, onOpenArchive, onClose }: {
  lastGameName: string
  onUploadJSON: () => void
  onImageScript: () => void
  onContinue: () => void
  onOpenArchive: () => void
  onClose: () => void
}) {
  const columnTitle: React.CSSProperties = { ...rounded(19, 700), color: 'color-mix(in srgb, var(--ink) 60%, transparent)' }
  const compact = useCompact()
  if (compact) {
    // 手机上两组按钮上下排，中间一条横线；太矮时卡片里面滚
    const title: React.CSSProperties = { ...rounded(16, 700), color: 'color-mix(in srgb, var(--ink) 60%, transparent)' }
    return (
      <div className="scroll-hidden" style={{
        width: 'min(420px, calc(100vw - 32px))', maxHeight: '100%', overflowY: 'auto', padding: 16, /* 20 - 描边 4 */
        display: 'flex', flexDirection: 'column', gap: 14,
        background: 'var(--mainbg)', borderRadius: 22, border: '4px solid var(--ink)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={rounded(22, 900)}>开始游戏</div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{ width: 38, height: 38, margin: '-6px -8px -6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}
            aria-label="关闭"
          >
            <SFIcon name="xmark" size={20} weight="black" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={title}>新的一局</div>
          <STBigButton title="上传剧本 JSON" systemImage="doc.fill" filled onClick={onUploadJSON} />
          <STBigButton title="用图片生成剧本" systemImage="photo.fill" onClick={onImageScript} />
        </div>
        <div style={{ height: 3, background: 'var(--ink)', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={title}>接着玩</div>
          {lastGameName ? (
            <STBigButton title="继续上一局" subtitle={lastGameName} systemImage="arrow.uturn.backward" filled onClick={onContinue} />
          ) : null}
          <STBigButton title="打开存档" systemImage="tray.full.fill" onClick={onOpenArchive} />
        </div>
      </div>
    )
  }
  return (
    <div style={{
      width: 760, padding: 24, /* 28 - 描边 4 */ display: 'flex', flexDirection: 'column', gap: 22,
      background: 'var(--mainbg)', borderRadius: 26, border: '4px solid var(--ink)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={rounded(30, 900)}>开始游戏</div>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ padding: 8, color: 'var(--ink)' }} aria-label="关闭">
          <SFIcon name="xmark" size={20} weight="black" />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 22 }}>
        <div style={{ flex: 1, minWidth: 0, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={columnTitle}>新的一局</div>
          <STBigButton title="上传剧本 JSON" systemImage="doc.fill" filled onClick={onUploadJSON} />
          <STBigButton title="用图片生成剧本" systemImage="photo.fill" onClick={onImageScript} />
        </div>
        <div style={{ width: 3, background: 'var(--ink)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={columnTitle}>接着玩</div>
          {lastGameName ? (
            <STBigButton title="继续上一局" subtitle={lastGameName} systemImage="arrow.uturn.backward" filled onClick={onContinue} />
          ) : null}
          <STBigButton title="打开存档" systemImage="tray.full.fill" onClick={onOpenArchive} />
        </div>
      </div>
    </div>
  )
}

// 记事本，对应 SubViews/notepad/NotepadView.swift：左边是常用词，点一下加到中间的大字里，给玩家看
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { game, setGame, useGame } from '../game/store'
import { settings, useSettings } from '../settings/store'
import { mono, rounded } from '../ui/kit'
import { HFlow } from '../setup/cards'
import { useCompact } from '../ui/compact'
import { SFIcon } from '../ui/SFIcon'
import { MobilePage } from '../mobile/MobilePage'
import { OverlayLayer, edgeBorder, panelHeight, stroke } from './common'

export function Notepad() {
  const show = useGame((s) => s.showNotepad)
  return show ? <NotepadView /> : null
}

function WordGroup({ words, onAdd }: { words: string[]; onAdd: (w: string) => void }) {
  return (
    // HFlow 只包住最宽的一行，在这一栏里居中（只有几个词时整块在中间）
    <HFlow style={{ padding: '20px 10px' }}>
      {words.map((w, i) => (
        <button
          key={i}
          onClick={() => onAdd(w)}
          style={{ ...mono(25, 600), color: 'var(--ink)', padding: '4px 8px', minHeight: 20, ...stroke(2, 10) }}
        >{w}</button>
      ))}
    </HFlow>
  )
}

const divider = <div style={{ height: 3, background: 'var(--ink)', flexShrink: 0 }} />

function NotepadView() {
  const players = useGame((s) => s.playersAssignedCharacters)
  const playable = useGame((s) => s.playableCharacters)
  const bluffs = useGame((s) => s.notPresentedGoodCharacters)
  const predefinedTags = useGame((s) => s.predefinedTags)
  const notepadTags = useSettings((s) => s.notepadTags)
  const [showPredefinedTags, setShowPredefinedTags] = useState(true)
  const [noteText, setNoteText] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  const compact = useCompact()
  const [showing, setShowing] = useState(false)

  // iPad 版的 predefinedTags 一开始就是设置里的常用词
  useEffect(() => {
    if (game().predefinedTags.length === 0 && notepadTags.length > 0) setGame({ predefinedTags: [...notepadTags] })
  }, [notepadTags])

  // TextField(axis: .vertical)：跟着字数长高
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [noteText, compact])

  const withPlayerInfo = players.flatMap((p, i) => [`${i + 1}号`, p.name])
  const assigned = new Set(players.map((p) => p.name))
  const withCharacterInfo = playable.map((c) => c.name).filter((n) => !assigned.has(n))
  const add = (w: string) => setNoteText((t) => `${t}${w} `)

  const save = () => {
    const tags = [...game().predefinedTags, noteText]
    setGame({ predefinedTags: tags })
    // 记事本里新加的常用词也记到设置里（StoryTellerView 的 onChange(of: predefinedTags)）
    if (JSON.stringify(tags) !== JSON.stringify(settings().notepadTags)) settings().set('notepadTags', tags)
  }

  const bottomButton = (label: string, onClick: () => void, edges: ('leading' | 'trailing')[]) => (
    <button
      onClick={onClick}
      style={{
        ...rounded(20, 600), color: 'var(--ink)', padding: 16, flex: 1,
        boxShadow: [edgeBorder(3, ['top']), edgeBorder(1.5, edges)].join(', '),
      }}
    >{label}</button>
  )

  if (compact) {
    const groups = [withPlayerInfo, bluffs.map((c) => c.name).filter((n) => n !== ''), withCharacterInfo, predefinedTags]
    const btn = (filled = false): React.CSSProperties => ({
      ...rounded(17, 700), flex: '1 1 0', minWidth: 0, height: 46, borderRadius: 14, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 5, whiteSpace: 'nowrap',
      color: filled ? 'var(--mainbg)' : 'var(--ink)', background: filled ? 'var(--ink)' : 'transparent', ...(filled ? null : stroke(2.5, 14)),
    })
    const empty = noteText.trim() === ''
    return (
      <MobilePage title="记事本" zIndex={113} scroll={false} onClose={() => setGame({ showNotepad: false })}>
        <div data-tour="notepad.panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* 上面是大字，字多了自己滚 */}
          <div className="scroll-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '12px 16px' }}>
            <textarea
              ref={area}
              rows={1}
              value={noteText}
              placeholder="输入信息"
              onChange={(e) => setNoteText(e.target.value)}
              style={{
                ...rounded(36, 700), textAlign: 'center', width: '100%', margin: 'auto 0', resize: 'none', color: 'var(--ink)',
                border: 'none', outline: 'none', background: 'transparent', padding: 0, overflow: 'hidden', lineHeight: 1.2, flexShrink: 0,
              }}
            />
          </div>
          {/* 预设词：点一下接到句子后面，可以收起 */}
          <div style={{
            height: showPredefinedTags ? '42%' : 0, flexShrink: 0, overflow: 'hidden', transition: 'height .3s ease-in-out',
            boxShadow: showPredefinedTags ? edgeBorder(3, ['top']) : 'none',
          }}>
            <div className="scroll-hidden" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: '3px 0 8px' }}>
              {groups.filter((g) => g.length > 0).map((g, gi) => (
                <div key={gi}>
                  {gi > 0 ? <div style={{ height: 2, margin: '0 12px', background: 'var(--ink)', opacity: 0.25 }} /> : null}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px' }}>
                    {g.map((w, i) => (
                      <button
                        key={i}
                        onClick={() => add(w)}
                        style={{
                          ...mono(18, 600), color: 'var(--ink)', padding: '0 11px', minHeight: 40, maxWidth: '100%',
                          overflowWrap: 'anywhere', ...stroke(2, 10),
                        }}
                      >{w}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', boxShadow: edgeBorder(3, ['top']), flexShrink: 0 }}>
            <button style={btn()} onClick={() => setShowPredefinedTags((v) => !v)}>{showPredefinedTags ? '收起' : '预设'}</button>
            <button style={btn()} onClick={() => setNoteText('')}>清空</button>
            <button style={btn()} onClick={save}>保存</button>
            <button style={{ ...btn(true), opacity: empty ? 0.35 : 1 }} disabled={empty} onClick={() => setShowing(true)}>
              <SFIcon name="eye" size={19} weight="bold" />
              <span>展示</span>
            </button>
          </div>
        </div>
        {showing ? <ShowToPlayer text={noteText} onClose={() => setShowing(false)} /> : null}
      </MobilePage>
    )
  }

  return (
    <OverlayLayer zIndex={13} background="var(--mainbg)" onDoubleTapBackground={() => setGame({ showNotepad: false })}>
      <div
        data-tour="notepad.panel"
        style={{
          position: 'relative', width: 800, height: `min(800px, ${panelHeight})`, background: 'var(--mainbg)',
          display: 'flex', overflow: 'hidden', ...stroke(3, 20),
        }}
      >
        <div style={{
          width: showPredefinedTags ? 200 : 0, flexShrink: 0, overflow: 'hidden',
          transition: 'width .5s ease-in-out',
        }}>
          <div style={{
            width: 200, height: '100%', boxShadow: edgeBorder(3, ['trailing']),
            transform: showPredefinedTags ? 'none' : 'translateX(-100%)', transition: 'transform .5s ease-in-out',
          }}>
            <div className="scroll-hidden" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <WordGroup words={withPlayerInfo} onAdd={add} />
              {divider}
              <WordGroup words={bluffs.map((c) => c.name).filter((n) => n !== '')} onAdd={add} />
              {divider}
              <WordGroup words={withCharacterInfo} onAdd={add} />
              {divider}
              <WordGroup words={predefinedTags} onAdd={add} />
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 10px' }}>
            <div style={{ flex: 1 }} />
            <textarea
              ref={area}
              rows={1}
              value={noteText}
              placeholder="输入信息"
              onChange={(e) => setNoteText(e.target.value)}
              style={{
                ...rounded(50, 700), textAlign: 'center', width: '100%', maxHeight: '100%', resize: 'none',
                border: 'none', outline: 'none', background: 'transparent', padding: 0, overflowY: 'auto',
                lineHeight: 1.2, flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex' }}>
            {bottomButton(showPredefinedTags ? '收起' : '预设', () => setShowPredefinedTags((v) => !v), ['trailing'])}
            {bottomButton('清空', () => setNoteText(''), ['leading', 'trailing'])}
            {bottomButton('保存', save, ['leading'])}
          </div>
        </div>
      </div>
    </OverlayLayer>
  )
}

/** 手机上给玩家看：整屏只有这句话，字尽量大，点一下回去 */
function ShowToPlayer({ text, onClose }: { text: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const txt = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(96)
  useLayoutEffect(() => {
    const fit = () => {
      const b = box.current
      const t = txt.current
      if (!b || !t) return
      // 从大往小试，放得下为止
      let s = 140
      t.style.fontSize = `${s}px`
      while (s > 24 && t.scrollHeight > b.clientHeight) { s -= 4; t.style.fontSize = `${s}px` }
      setSize(s)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [text])
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 120, background: 'var(--mainbg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column',
        padding: 'calc(20px + env(safe-area-inset-top)) 20px calc(14px + env(safe-area-inset-bottom))', animation: 'st-fade .2s ease-out',
      }}
    >
      <div ref={box} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <div ref={txt} style={{
          ...rounded(40, 900), fontSize: size, width: '100%', textAlign: 'center', lineHeight: 1.15,
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
        }}>{text.trim()}</div>
      </div>
      <div style={{ ...rounded(14, 700), opacity: 0.45, textAlign: 'center', flexShrink: 0, paddingTop: 10 }}>点一下返回</div>
    </div>,
    document.body,
  )
}

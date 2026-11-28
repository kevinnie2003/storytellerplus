// 配版页右边的“设置调整”（会影响配版的角色）和返回/确认/退出，对应 ExtraSetupForSetup.swift
import { useState } from 'react'
import { setGame, useGame } from '../game/store'
import { CachedImage } from '../ui/CachedImage'
import { useCompact } from '../ui/compact'
import { rounded } from '../ui/kit'
import { SFIcon } from '../ui/SFIcon'
import { boxButton } from './cards'
import { setSelectionState, useSetupFlow } from './flowState'
import { MobileBar } from './MobileBar'
import { barButton } from './mobileStyles'

/**
 * status、extra 只在手机上用：手机上这一栏变成底部操作条，
 * status 是左上的数量，extra 是排在“确认”后面的按钮。退出用标题栏的 ✕
 */
export function ExtraSetupForSetup({ status, extra }: { status?: React.ReactNode; extra?: React.ReactNode } = {}) {
  const playableCharacters = useGame((s) => s.playableCharacters)
  const compact = useCompact()
  const [showAdjust, setShowAdjust] = useState(false)
  const back = () => setSelectionState(Math.max(useSetupFlow.getState().selectionState - 1, 0))
  const confirm = () => setSelectionState(useSetupFlow.getState().selectionState + 1)

  if (compact) {
    const adjust = playableCharacters.filter((c) => c.setup)
    return (
      <MobileBar
        status={status}
        accessory={adjust.length > 0 ? (
          <button
            onClick={() => setShowAdjust(!showAdjust)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, height: 36, padding: '0 12px', borderRadius: 18, flexShrink: 0,
              border: '2.5px solid var(--ink)', color: 'var(--ink)', ...rounded(14, 800), whiteSpace: 'nowrap',
            }}
          >
            <span>设置调整 {adjust.length}</span>
            <SFIcon name={showAdjust ? 'chevron.down' : 'chevron.up'} size={14} weight="bold" />
          </button>
        ) : null}
        panel={showAdjust && adjust.length > 0 ? (
          <div className="scroll-hidden" style={{
            maxHeight: '38vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
            borderRadius: 12, outline: '2.5px solid var(--ink)', outlineOffset: -1.25, padding: '4px 0',
          }}>
            {adjust.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
                <CachedImage url={c.imageURL} size={44} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={rounded(16, 800)}>{c.name}</div>
                  <div style={{ ...rounded(14, 600), lineHeight: 1.35 }}>{c.ability}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        buttonsTour="setup.panelButtons"
      >
        <button style={barButton()} onClick={back}>返回</button>
        <button style={barButton(!extra)} onClick={confirm}>确认</button>
        {extra}
      </MobileBar>
    )
  }

  const btn = boxButton(20, 20, 10, 3)
  return (
    <div style={{ width: 260, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="scroll-hidden" style={{
        flex: 1, minHeight: 0, overflowY: 'auto', width: '100%', background: 'var(--mainbg)',
        // 描边是 overlay，不占里面的位置：里面的字和 iPad 一样宽，一行排得下一样多的字
        borderRadius: 10, outline: '3px solid var(--ink)', outlineOffset: -1.5,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <div style={{ ...rounded(25, 700), paddingTop: 10, flexShrink: 0 }}>设置调整</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 20, width: '100%', flexShrink: 0 }}>
          {playableCharacters.map((c) => c.setup ? (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px' }}>
              <CachedImage url={c.imageURL} size={50} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={rounded(20, 700)}>{c.name}</div>
                <div style={rounded(15, 600)}>{c.ability}</div>
              </div>
            </div>
          ) : null)}
        </div>
      </div>
      <div data-tour="setup.panelButtons" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <button style={btn} onClick={back}>返回</button>
        <button style={btn} onClick={confirm}>确认</button>
        <button style={btn} onClick={() => setGame({ showSetup: false })}>退出</button>
      </div>
    </div>
  )
}

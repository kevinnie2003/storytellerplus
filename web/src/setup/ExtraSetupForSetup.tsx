// 配版页右边的“设置调整”（会影响配版的角色）和返回/确认/退出，对应 ExtraSetupForSetup.swift
import { setGame, useGame } from '../game/store'
import { CachedImage } from '../ui/CachedImage'
import { rounded } from '../ui/kit'
import { boxButton } from './cards'
import { setSelectionState, useSetupFlow } from './flowState'

export function ExtraSetupForSetup() {
  const playableCharacters = useGame((s) => s.playableCharacters)
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
        <button style={btn} onClick={() => setSelectionState(Math.max(useSetupFlow.getState().selectionState - 1, 0))}>返回</button>
        <button style={btn} onClick={() => setSelectionState(useSetupFlow.getState().selectionState + 1)}>确认</button>
        <button style={btn} onClick={() => setGame({ showSetup: false })}>退出</button>
      </div>
    </div>
  )
}

// 玩家盲选某个阵营的牌（卡背朝上），对应 SetupBlindPick.swift
import { useState } from 'react'
import { useCompact } from '../ui/compact'
import { rounded } from '../ui/kit'
import { boxButton, CardBack, CardGrid, HFlow } from './cards'
import { MobileBar } from './MobileBar'
import { barButton, phoneHint, phoneScroll } from './mobileStyles'
import { setFlow, setSelectionState, teamColors, teamNameEnglish, teamNames, useSetupFlow } from './flowState'

export function SetupBlindPick({ stage }: { stage: number }) {
  // 跳到最后一步时这一页还在淡出，阶段号会超过 11，要夹住，不然数组越界
  const teamIndex = Math.min(Math.max(Math.floor(stage / 3), 0), 3)
  const teamName = teamNames[teamIndex]
  const teamEnglish = teamNameEnglish[teamIndex]
  const teamColor = teamColors[teamIndex]
  const deck = useSetupFlow((s) => s.playableCharactersShuffled)
  const cardSelected = useSetupFlow((s) => s.cardSelected)
  const selectedTeamCounts = useSetupFlow((s) => s.selectedTeamCounts)
  // onAppear：数一下这个阵营已经选了几张
  const [selectedCount, setSelectedCount] = useState(() => {
    const f = useSetupFlow.getState()
    return f.playableCharactersShuffled.filter((c, i) => c.team === teamEnglish && f.cardSelected[i]).length
  })

  const tap = (index: number) => {
    const sel = [...useSetupFlow.getState().cardSelected]
    if (!sel[index] && selectedCount < selectedTeamCounts[teamIndex]) {
      sel[index] = true
      setFlow({ cardSelected: sel })
      setSelectedCount(selectedCount + 1)
    } else if (sel[index]) {
      sel[index] = false
      setFlow({ cardSelected: sel })
      setSelectedCount(selectedCount - 1)
    }
  }

  const compact = useCompact()
  if (compact) {
    // 手机：上面说明，中间一格一格的卡背，底下操作条
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="scroll-hidden" style={phoneScroll}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center' }}>
            <div style={rounded(22, 900)}>请玩家选择 {selectedTeamCounts[teamIndex]} 张{teamName}卡片</div>
            <div style={phoneHint}>把手机递给玩家，点背面朝上的牌选中，再点一下取消。不需要玩家参与配版就直接点“确认”</div>
          </div>
          <CardGrid target={110} center data-tour="setup.pickCards" style={{ padding: '6px 4px' }}>
            {deck.map((c, index) => c.team === teamEnglish ? (
              <div key={index} onClick={() => tap(index)} style={{
                width: 200, height: 300, cursor: 'pointer',
                transform: `scale(${cardSelected[index] ? 1.06 : 0.94})`, transition: 'transform .3s ease-in-out',
              }}>
                <CardBack cardColor={teamColor} dim={cardSelected[index] ? 1 : 0.7} />
              </div>
            ) : null)}
          </CardGrid>
        </div>
        <MobileBar status={`已选择 ${selectedCount} / ${selectedTeamCounts[teamIndex]} 张${teamName}卡片`} buttonsTour="setup.pickButtons">
          <button style={barButton()} onClick={() => setSelectionState(useSetupFlow.getState().selectionState - 1)}>返回</button>
          <button style={barButton(true)} onClick={() => setSelectionState(useSetupFlow.getState().selectionState + 1)}>确认</button>
        </MobileBar>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center',
        width: '100%', padding: '20px 0', flexShrink: 0,
      }}>
        <div style={rounded(35, 700)}>请玩家选择 {selectedTeamCounts[teamIndex]} 张{teamName}卡片</div>
        <div style={{ ...rounded(20, 600), color: 'color-mix(in srgb, var(--ink) 60%, transparent)' }}>不需要玩家参与配版就直接点确认</div>
      </div>
      <div style={{ ...rounded(30, 700), paddingBottom: 20, flexShrink: 0 }}>已选择 {selectedCount} 张{teamName}卡片</div>
      <HFlow center data-tour="setup.pickCards" style={{ flexShrink: 0 }}>
        {deck.map((c, index) => c.team === teamEnglish ? (
          <div key={index} style={{ padding: '40px 50px' }} onClick={() => tap(index)}>
            <div style={{
              transform: `scale(${cardSelected[index] ? 1.1 : 1})`,
              transition: 'transform .3s ease-in-out', cursor: 'pointer',
            }}>
              <CardBack cardColor={teamColor} dim={cardSelected[index] ? 1 : 0.7} />
            </div>
          </div>
        ) : null)}
      </HFlow>
      {/* iPad 上这里的 Spacer() 在 ScrollView 里不占地方 */}
      <div data-tour="setup.pickButtons" style={{ display: 'flex', gap: 60, marginTop: 40, flexShrink: 0 }}>
        <button style={boxButton(30, 30, 15, 4)} onClick={() => setSelectionState(useSetupFlow.getState().selectionState - 1)}>返回</button>
        <button style={boxButton(30, 30, 15, 4)} onClick={() => setSelectionState(useSetupFlow.getState().selectionState + 1)}>确认</button>
      </div>
    </div>
  )
}
